import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
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
          <h1 className="text-xl font-bold text-gray-800">Privacy Policy / นโยบายความเป็นส่วนตัว</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm p-8 space-y-8">
          <div className="text-center border-b pb-6">
            <h2 className="text-2xl font-bold text-gray-800" data-testid="text-privacy-title">นโยบายความเป็นส่วนตัว</h2>
            <p className="text-gray-500 mt-1">Privacy Policy</p>
            <p className="text-sm text-gray-400 mt-2">ปรับปรุงล่าสุด: กุมภาพันธ์ 2569 / Last updated: February 2026</p>
          </div>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-[#fb9678]">1. บทนำ / Introduction</h3>
            <p className="text-gray-700 leading-relaxed">
              E-Tax Center ("แพลตฟอร์ม", "เรา") ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของผู้ใช้บริการ
              นโยบายความเป็นส่วนตัวฉบับนี้อธิบายถึงวิธีการเก็บรวบรวม ใช้ เปิดเผย
              และคุ้มครองข้อมูลส่วนบุคคลของท่าน ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
            </p>
            <p className="text-gray-600 text-sm leading-relaxed italic">
              E-Tax Center ("Platform", "we", "us") values the protection of personal data of our users.
              This Privacy Policy explains how we collect, use, disclose, and protect your personal data
              in accordance with the Personal Data Protection Act B.E. 2562 (PDPA) of Thailand.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-[#fb9678]">2. ข้อมูลที่เราเก็บรวบรวม / Data We Collect</h3>
            <p className="text-gray-700 leading-relaxed">เราอาจเก็บรวบรวมข้อมูลส่วนบุคคลดังต่อไปนี้:</p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li><strong>ข้อมูลระบุตัวตน:</strong> ชื่อ-นามสกุล, เลขประจำตัวผู้เสียภาษี, ที่อยู่ / <em className="text-gray-500">Name, tax ID, address</em></li>
              <li><strong>ข้อมูลติดต่อ:</strong> อีเมล, หมายเลขโทรศัพท์ / <em className="text-gray-500">Email, phone number</em></li>
              <li><strong>ข้อมูลบัญชี:</strong> ชื่อผู้ใช้, รหัสผ่าน (เข้ารหัส), บทบาทผู้ใช้ / <em className="text-gray-500">Username, password (encrypted), user role</em></li>
              <li><strong>ข้อมูลทางการเงิน:</strong> ข้อมูลธุรกรรม, ใบกำกับภาษี, รายการบัญชี / <em className="text-gray-500">Transaction data, tax invoices, journal entries</em></li>
              <li><strong>ข้อมูล E-Commerce:</strong> ข้อมูลออเดอร์, ข้อมูลร้านค้า, โทเค็นการเชื่อมต่อแพลตฟอร์ม / <em className="text-gray-500">Order data, store info, platform connection tokens</em></li>
              <li><strong>ข้อมูลการใช้งาน:</strong> บันทึกกิจกรรม, IP address, ข้อมูลเบราว์เซอร์ / <em className="text-gray-500">Activity logs, IP address, browser info</em></li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-[#fb9678]">3. วัตถุประสงค์ในการใช้ข้อมูล / Purpose of Data Use</h3>
            <p className="text-gray-700 leading-relaxed">เราใช้ข้อมูลส่วนบุคคลของท่านเพื่อ:</p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>ให้บริการแพลตฟอร์มบัญชีดิจิทัลและจัดการธุรกิจ / <em className="text-gray-500">Provide digital accounting and business management services</em></li>
              <li>เชื่อมต่อกับแพลตฟอร์ม E-Commerce (Shopee, Lazada, TikTok Shop, Amazon) ตามที่ท่านอนุญาต / <em className="text-gray-500">Connect with e-commerce platforms as authorized by you</em></li>
              <li>ออกเอกสารทางการเงินและภาษี / <em className="text-gray-500">Generate financial and tax documents</em></li>
              <li>คำนวณเงินเดือน ภาษี และประกันสังคม / <em className="text-gray-500">Calculate payroll, taxes, and social security</em></li>
              <li>ปรับปรุงและพัฒนาบริการ / <em className="text-gray-500">Improve and develop our services</em></li>
              <li>ปฏิบัติตามกฎหมายและข้อบังคับที่เกี่ยวข้อง / <em className="text-gray-500">Comply with applicable laws and regulations</em></li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-[#fb9678]">4. การเปิดเผยข้อมูล / Data Disclosure</h3>
            <p className="text-gray-700 leading-relaxed">
              เราจะไม่ขาย แลกเปลี่ยน หรือเปิดเผยข้อมูลส่วนบุคคลของท่านแก่บุคคลที่สาม เว้นแต่:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>แพลตฟอร์ม E-Commerce ที่ท่านเลือกเชื่อมต่อ (ผ่าน OAuth) / <em className="text-gray-500">E-commerce platforms you choose to connect (via OAuth)</em></li>
              <li>ผู้ให้บริการที่จำเป็นสำหรับการดำเนินงาน (เช่น ผู้ให้บริการอีเมล, Cloud Storage) / <em className="text-gray-500">Essential service providers (e.g., email, cloud storage)</em></li>
              <li>เมื่อมีคำสั่งศาลหรือหน่วยงานรัฐตามกฎหมาย / <em className="text-gray-500">When required by court order or government authorities</em></li>
              <li>เมื่อได้รับความยินยอมจากท่าน / <em className="text-gray-500">With your explicit consent</em></li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-[#fb9678]">5. การรักษาความปลอดภัยข้อมูล / Data Security</h3>
            <p className="text-gray-700 leading-relaxed">เราใช้มาตรการรักษาความปลอดภัยดังนี้:</p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>เข้ารหัสรหัสผ่านด้วย scrypt / <em className="text-gray-500">Password encryption using scrypt</em></li>
              <li>การสื่อสารผ่าน HTTPS/TLS 1.2+ / <em className="text-gray-500">HTTPS/TLS 1.2+ encrypted communication</em></li>
              <li>เก็บ API credentials อย่างปลอดภัย ไม่เปิดเผยผ่าน API / <em className="text-gray-500">Secure API credential storage, never exposed via API</em></li>
              <li>ระบบ OAuth 2.0 สำหรับเชื่อมต่อแพลตฟอร์มภายนอก / <em className="text-gray-500">OAuth 2.0 for external platform connections</em></li>
              <li>Role-based access control (RBAC) แบ่งระดับสิทธิ์ผู้ใช้ / <em className="text-gray-500">Role-based access control for user permissions</em></li>
              <li>บันทึกกิจกรรม (Audit Log) ทุกการเปลี่ยนแปลง / <em className="text-gray-500">Activity logging (Audit Log) for all changes</em></li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-[#fb9678]">6. การเก็บรักษาข้อมูล / Data Retention</h3>
            <p className="text-gray-700 leading-relaxed">
              เราจะเก็บรักษาข้อมูลส่วนบุคคลของท่านตลอดระยะเวลาที่ท่านใช้บริการ
              และเป็นระยะเวลาที่จำเป็นตามกฎหมาย (เอกสารภาษี 5 ปี ตามประมวลรัษฎากร)
              หลังจากนั้นข้อมูลจะถูกลบหรือทำให้ไม่สามารถระบุตัวตนได้
            </p>
            <p className="text-gray-600 text-sm italic">
              We retain your personal data for the duration of your service usage
              and as required by law (tax documents for 5 years per Revenue Code).
              After that, data will be deleted or anonymized.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-[#fb9678]">7. สิทธิของเจ้าของข้อมูล / Data Subject Rights</h3>
            <p className="text-gray-700 leading-relaxed">ท่านมีสิทธิตาม PDPA ดังนี้:</p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>สิทธิในการเข้าถึงข้อมูลส่วนบุคคลของท่าน / <em className="text-gray-500">Right to access your personal data</em></li>
              <li>สิทธิในการแก้ไขข้อมูลให้ถูกต้อง / <em className="text-gray-500">Right to rectification</em></li>
              <li>สิทธิในการลบข้อมูล / <em className="text-gray-500">Right to erasure</em></li>
              <li>สิทธิในการระงับการใช้ข้อมูล / <em className="text-gray-500">Right to restriction of processing</em></li>
              <li>สิทธิในการโอนย้ายข้อมูล / <em className="text-gray-500">Right to data portability</em></li>
              <li>สิทธิในการคัดค้านการประมวลผลข้อมูล / <em className="text-gray-500">Right to object to processing</em></li>
              <li>สิทธิในการถอนความยินยอม / <em className="text-gray-500">Right to withdraw consent</em></li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-[#fb9678]">8. การโอนข้อมูลไปต่างประเทศ / Cross-Border Data Transfer</h3>
            <p className="text-gray-700 leading-relaxed">
              ในกรณีที่ท่านเชื่อมต่อกับแพลตฟอร์ม E-Commerce ข้อมูลบางส่วนอาจถูกส่งไปยังเซิร์ฟเวอร์ของแพลตฟอร์มในต่างประเทศ
              (เช่น สิงคโปร์ จีน) ตามที่จำเป็นสำหรับการเชื่อมต่อ API เราจะดำเนินการโอนข้อมูลเฉพาะเมื่อ:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>ประเทศปลายทางมีมาตรฐานการคุ้มครองข้อมูลที่เพียงพอ / <em className="text-gray-500">Destination country has adequate data protection standards</em></li>
              <li>ท่านได้ให้ความยินยอมในการเชื่อมต่อแพลตฟอร์มดังกล่าว / <em className="text-gray-500">You have consented to connecting the platform</em></li>
              <li>มีมาตรการรักษาความปลอดภัยที่เหมาะสม (HTTPS/TLS) / <em className="text-gray-500">Appropriate security measures are in place (HTTPS/TLS)</em></li>
            </ul>
            <p className="text-gray-600 text-sm italic">
              When connecting to e-commerce platforms, some data may be transferred to their servers abroad
              (e.g., Singapore, China). Transfers occur only with your consent and adequate security measures.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-[#fb9678]">9. การถอนความยินยอม / Consent Withdrawal</h3>
            <p className="text-gray-700 leading-relaxed">
              ท่านมีสิทธิ์ถอนความยินยอมในการเก็บรวบรวม ใช้ หรือเปิดเผยข้อมูลส่วนบุคคลได้ตลอดเวลา
              โดยการถอนความยินยอมจะไม่กระทบต่อความชอบด้วยกฎหมายของการประมวลผลที่ได้ดำเนินไปแล้ว
              การถอนความยินยอมอาจส่งผลให้ท่านไม่สามารถใช้บริการบางอย่างได้
            </p>
            <p className="text-gray-600 text-sm italic">
              You may withdraw consent at any time. Withdrawal does not affect the lawfulness of prior processing.
              It may result in inability to use certain services.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-[#fb9678]">10. การเชื่อมต่อแพลตฟอร์มภายนอก / Third-Party Platform Integration</h3>
            <p className="text-gray-700 leading-relaxed">
              เมื่อท่านเชื่อมต่อบัญชี E-Commerce ของท่าน (Shopee, Lazada, TikTok Shop, Amazon)
              ผ่านระบบ OAuth เราจะเข้าถึงเฉพาะข้อมูลที่ท่านอนุญาตเท่านั้น
              ท่านสามารถยกเลิกการเชื่อมต่อได้ตลอดเวลาผ่านหน้าตั้งค่าในแพลตฟอร์ม
            </p>
            <p className="text-gray-600 text-sm italic">
              When you connect your e-commerce accounts via OAuth, we only access data you authorize.
              You may disconnect at any time through the platform settings.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-[#fb9678]">11. ผู้ควบคุมข้อมูลและเจ้าหน้าที่คุ้มครองข้อมูล / Data Controller & DPO</h3>
            <div className="bg-gray-50 rounded-lg p-4 text-gray-700 space-y-3">
              <div>
                <p className="font-semibold">ผู้ควบคุมข้อมูลส่วนบุคคล / Data Controller</p>
                <p>E-Tax Center</p>
                <p>อีเมล: support@etaxcenter.com</p>
              </div>
              <div>
                <p className="font-semibold">เจ้าหน้าที่คุ้มครองข้อมูลส่วนบุคคล (DPO) / Data Protection Officer</p>
                <p>อีเมล: privacy@etaxcenter.com</p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-[#fb9678]">12. การร้องเรียน / Complaints</h3>
            <p className="text-gray-700 leading-relaxed">
              หากท่านเชื่อว่าการประมวลผลข้อมูลส่วนบุคคลของท่านไม่เป็นไปตาม PDPA
              ท่านมีสิทธิ์ร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล (สคส.)
            </p>
            <p className="text-gray-600 text-sm italic">
              If you believe your personal data is processed in violation of the PDPA,
              you have the right to lodge a complaint with the Personal Data Protection Committee (PDPC).
            </p>
            <div className="bg-gray-50 rounded-lg p-4 text-gray-700">
              <p className="font-semibold">สำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล (PDPC)</p>
              <p>เว็บไซต์: www.pdpc.or.th</p>
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
