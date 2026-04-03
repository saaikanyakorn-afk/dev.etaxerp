import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Menu, X } from "lucide-react";
const logoWhite = "/logo-etax-white.png";

const NAV_LINKS = [
  { label: "หน้าหลัก", href: "/landing" },
  { label: "ฟีเจอร์", href: "/features" },
  { label: "แพ็คเกจ & ราคา", href: "/pricing" },
  { label: "เกี่ยวกับเรา", href: "/about" },
  { label: "ติดต่อเรา", href: "/contact" },
];

export default function PublicNavbar() {
  const [location, navigate] = useLocation();
  const [mobileMenu, setMobileMenu] = useState(false);

  return (
    <nav className="fixed left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-b border-gray-100/80" style={{ top: "var(--dev-bar-h, 0px)" }}>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[70px]">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/landing")} data-testid="nav-logo">
            <div className="h-11 px-4 rounded-xl bg-[#03c9d7] flex items-center justify-center">
              <img src={logoWhite} alt="E-Tax Center" className="h-6 object-contain" />
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 text-[14px] font-medium rounded-lg transition-all ${
                  location === link.href
                    ? "text-[#03c9d7] bg-[#03c9d7]/5 font-semibold"
                    : "text-gray-600 hover:text-[#03c9d7] hover:bg-[#03c9d7]/5"
                }`}
                data-testid={`nav-${link.href.replace(/\//g, "")}`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => navigate("/login")}
              className="px-5 py-2.5 text-[14px] font-semibold text-[#03c9d7] hover:bg-[#03c9d7]/5 rounded-lg transition-all"
              data-testid="nav-login"
            >
              เข้าสู่ระบบ
            </button>
            <button
              onClick={() => navigate("/register")}
              className="px-5 py-2.5 text-[14px] font-semibold text-white bg-[#03c9d7] rounded-lg hover:bg-[#02b5c2] transition-all shadow-md shadow-[#03c9d7]/25"
              data-testid="nav-register"
            >
              ทดลองใช้ฟรี
            </button>
          </div>

          <button className="md:hidden p-2 rounded-lg hover:bg-gray-100" onClick={() => setMobileMenu(!mobileMenu)} data-testid="nav-mobile-toggle">
            {mobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileMenu && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 pb-4 space-y-1 shadow-lg">
          {NAV_LINKS.map(link => (
            <Link key={link.href} href={link.href} onClick={() => setMobileMenu(false)}
              className={`block w-full text-left py-3 px-3 text-[14px] font-medium rounded-lg ${location === link.href ? "text-[#03c9d7] bg-[#03c9d7]/5" : "text-gray-600 hover:bg-gray-50"}`}
              data-testid={`nav-mobile-${link.href.replace(/\//g, "")}`}
            >
              {link.label}
            </Link>
          ))}
          <div className="flex gap-2 pt-3 border-t border-gray-100">
            <button onClick={() => { setMobileMenu(false); navigate("/login"); }} className="flex-1 py-2.5 text-[14px] font-semibold text-[#03c9d7] border border-[#03c9d7] rounded-lg">เข้าสู่ระบบ</button>
            <button onClick={() => { setMobileMenu(false); navigate("/register"); }} className="flex-1 py-2.5 text-[14px] font-semibold text-white bg-[#03c9d7] rounded-lg">ทดลองใช้ฟรี</button>
          </div>
        </div>
      )}
    </nav>
  );
}
