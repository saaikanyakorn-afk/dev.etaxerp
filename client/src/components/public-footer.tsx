import { Link } from "wouter";
import { Phone, Mail, MapPin } from "lucide-react";
import logoWhite from "@assets/Logo_Etax_W_1771262337378.png";

export default function PublicFooter() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="md:col-span-1">
            <div className="flex items-center mb-5">
              <div className="h-11 px-4 rounded-xl bg-[#03c9d7] flex items-center justify-center">
                <img src={logoWhite} alt="E-Tax Center" className="h-6 object-contain" />
              </div>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed mb-5">ระบบบัญชีอัจฉริยะครบวงจร สำหรับสำนักงานบัญชีและธุรกิจทุกขนาด</p>
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
                <span>กรุงเทพมหานคร ประเทศไทย</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-sm mb-4 text-white">สินค้า & บริการ</h4>
            <ul className="space-y-2.5 text-sm text-gray-400">
              <li><Link href="/features" className="hover:text-[#03c9d7] transition-colors">ฟีเจอร์ทั้งหมด</Link></li>
              <li><Link href="/pricing" className="hover:text-[#03c9d7] transition-colors">แพ็คเกจ & ราคา</Link></li>
              <li><Link href="/ecommerce-pricing" className="hover:text-[#03c9d7] transition-colors">E-Commerce Hub</Link></li>
              <li><Link href="/accounting-pricing" className="hover:text-[#03c9d7] transition-colors">โปรแกรมบัญชี</Link></li>
              <li><Link href="/delivery-pricing" className="hover:text-[#03c9d7] transition-colors">Delivery Hub</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-sm mb-4 text-white">แหล่งข้อมูล</h4>
            <ul className="space-y-2.5 text-sm text-gray-400">
              <li><Link href="/about" className="hover:text-[#03c9d7] transition-colors">เกี่ยวกับเรา</Link></li>
              <li><Link href="/contact" className="hover:text-[#03c9d7] transition-colors">ติดต่อเรา</Link></li>
              <li><Link href="/user-guide" className="hover:text-[#03c9d7] transition-colors">คู่มือการใช้งาน</Link></li>
              <li><Link href="/privacy-policy" className="hover:text-[#03c9d7] transition-colors">นโยบายความเป็นส่วนตัว</Link></li>
              <li><Link href="/terms-of-service" className="hover:text-[#03c9d7] transition-colors">ข้อกำหนดการใช้งาน</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-sm mb-4 text-white">กลุ่มลูกค้า</h4>
            <ul className="space-y-2.5 text-sm text-gray-400">
              <li><Link href="/pricing" className="hover:text-[#03c9d7] transition-colors">ธุรกิจทั่วไป</Link></li>
              <li><Link href="/pricing" className="hover:text-[#03c9d7] transition-colors">ร้านค้าออนไลน์</Link></li>
              <li><Link href="/pricing" className="hover:text-[#03c9d7] transition-colors">สำนักงานบัญชี</Link></li>
              <li><Link href="/pricing" className="hover:text-[#03c9d7] transition-colors">ร้านอาหาร</Link></li>
              <li><Link href="/register" className="hover:text-[#03c9d7] transition-colors">สมัครใช้งานฟรี</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">&copy; {new Date().getFullYear()} E-Tax Center. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy-policy" className="text-xs text-gray-500 hover:text-[#03c9d7]">Privacy</Link>
            <Link href="/terms-of-service" className="text-xs text-gray-500 hover:text-[#03c9d7]">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
