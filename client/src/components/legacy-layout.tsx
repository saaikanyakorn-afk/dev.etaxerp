import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useThemeColor } from "@/hooks/use-theme-color";
import { cn } from "@/lib/utils";
import { LegacyCompanyProvider, useLegacyCompany } from "@/lib/legacy-company-context";
import {
  Upload,
  FolderArchive,
  LogOut,
  UserCircle,
  Menu,
  X,
  ArrowLeft,
  BookOpen,
  Users,
  Building2,
  ChevronDown,
  ChevronRight,
  Search,
  ShoppingCart,
  CreditCard,
  Wallet,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const LEGACY_NAV = [
  {
    key: "import",
    icon: Upload,
    label: "นำเข้าข้อมูล",
    children: [
      { label: "นำเข้า CSV → ZIP", href: "/legacy-import" },
      { label: "นำเข้า ZIP → ฐานข้อมูล", href: "/legacy-import/import-db" },
      { label: "เปิดดู ZIP", href: "/legacy-import/viewer" },
      { label: "จัดการบริษัท (Archive)", href: "/legacy-import/company-manager" },
    ],
  },
  {
    key: "sales",
    icon: ShoppingCart,
    label: "เอกสารขาย",
    children: [
      { label: "ใบเสนอราคา [QO]", href: "/legacy-import/documents/type/quotation" },
      { label: "ใบแจ้งหนี้ [IV]", href: "/legacy-import/documents/type/bill" },
      { label: "ใบวางบิล [BN]", href: "/legacy-import/documents/type/bn" },
      { label: "ใบเสร็จรับเงิน [RC]", href: "/legacy-import/documents/type/receipt" },
    ],
  },
  {
    key: "purchase",
    icon: CreditCard,
    label: "เอกสารซื้อ",
    children: [
      { label: "ใบสั่งซื้อ [PO]", href: "/legacy-import/documents/type/po" },
      { label: "ค่าใช้จ่าย [EX]", href: "/legacy-import/documents/type/expense" },
      { label: "ใบสำคัญจ่าย [PV]", href: "/legacy-import/documents/type/payment" },
    ],
  },
  {
    key: "finance",
    icon: Wallet,
    label: "การเงิน",
    children: [
      { label: "หัก ณ ที่จ่าย [WT]", href: "/legacy-import/documents/type/wht" },
    ],
  },
  {
    key: "journal",
    icon: BookOpen,
    label: "สมุดรายวัน",
    children: [
      { label: "รายการสมุดรายวัน", href: "/legacy-import/gl-journal" },
    ],
  },
  {
    key: "accounting",
    icon: BookOpen,
    label: "การบัญชี",
    children: [
      { label: "ผังบัญชี", href: "/legacy-import/chart-of-accounts" },
    ],
  },
  {
    key: "reports",
    icon: BarChart3,
    label: "รายงาน",
    children: [
      { label: "งบทดลอง", href: "/legacy-import/reports/trial-balance" },
      { label: "บัญชีแยกประเภท", href: "/legacy-import/reports/general-ledger" },
      { label: "งบกำไรขาดทุน", href: "/legacy-import/reports/income-statement" },
      { label: "งบดุล", href: "/legacy-import/reports/balance-sheet" },
      { label: "สรุปภาษี", href: "/legacy-import/reports/tax-summary" },
    ],
  },
  {
    key: "contacts",
    icon: Users,
    label: "คู่ค้า",
    children: [
      { label: "รายชื่อคู่ค้า", href: "/legacy-import/contacts" },
    ],
  },
];

function LegacyLayoutInner({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const { colors: themeColors } = useThemeColor();
  const { companies, selectedId, setSelectedId, selectedCompany } = useLegacyCompany();
  const [companySearch, setCompanySearch] = useState("");
  const [companyPopoverOpen, setCompanyPopoverOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
    const match = LEGACY_NAV.find(item =>
      item.children.some(c => location === c.href || location.startsWith(c.href + "/"))
    );
    setOpenMenus(match ? [match.key] : []);
  }, [location]);

  useEffect(() => {
    if (!user) setLocation("/legacy-import/login");
  }, [user, setLocation]);

  if (!user) return null;

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(companySearch.toLowerCase())
  );

  const toggleMenu = (key: string) => {
    setOpenMenus(prev => prev.includes(key) ? [] : [key]);
  };

  return (
    <div className="min-h-screen bg-gray-50/50 flex font-sans">
      <aside className={cn(
        "w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col fixed h-full z-30 overflow-y-auto transition-transform shadow-sm",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div
          className="flex items-center px-4 border-b border-sidebar-border shrink-0 relative overflow-hidden"
          style={{ background: themeColors.primary, height: "68px" }}
        >
          <Link href="/legacy-import" className="flex items-center gap-3 group cursor-pointer flex-1 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white shadow-lg">
              <FolderArchive className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading tracking-tight text-white leading-none text-base font-semibold">TRCloud Archive</span>
              <span className="text-[9px] font-medium text-white/70 uppercase tracking-widest mt-1">Legacy Data Viewer</span>
            </div>
          </Link>
          <button
            className="md:hidden ml-2 p-1 rounded hover:bg-white/20 text-white relative z-10"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 shrink-0">
          {companies.length > 0 ? (
            <Popover open={companyPopoverOpen} onOpenChange={(open) => { setCompanyPopoverOpen(open); if (!open) setCompanySearch(""); }}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  data-testid="button-legacy-company-switcher"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Building2 className="h-4 w-4 shrink-0" />
                    <span className="truncate text-sm">{selectedCompany?.name || "เลือกบริษัท"}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0 bg-sidebar border-sidebar-border" align="start">
                <div className="p-2 border-b border-sidebar-border">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-sidebar-foreground/50" />
                    <Input
                      placeholder="ค้นหาบริษัท..."
                      value={companySearch}
                      onChange={e => setCompanySearch(e.target.value)}
                      className="pl-8 h-8 text-sm bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/40"
                      data-testid="input-legacy-company-search"
                    />
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto p-1">
                  {filteredCompanies.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-sidebar-foreground/50">ไม่พบบริษัท</div>
                  ) : (
                    filteredCompanies.map(company => (
                      <button
                        key={company.id}
                        className={cn(
                          "w-full text-left flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer transition-colors",
                          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground",
                          selectedId === company.id && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        )}
                        onClick={() => {
                          setSelectedId(company.id);
                          setCompanyPopoverOpen(false);
                          setCompanySearch("");
                        }}
                        data-testid={`menu-legacy-company-${company.id}`}
                      >
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{company.name}</span>
                      </button>
                    ))
                  )}
                </div>
                <div className="border-t border-sidebar-border px-3 py-1.5">
                  <span className="text-[10px] text-sidebar-foreground/40">{companies.length} บริษัท</span>
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <div className="w-full flex items-center gap-2 px-3 py-2 bg-sidebar-accent/50 border border-sidebar-border rounded-md text-sidebar-foreground/50 text-sm">
              <Building2 className="h-4 w-4 shrink-0" />
              <span className="truncate">ยังไม่มีข้อมูลนำเข้า</span>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 space-y-1 pb-4 min-h-0">
          {LEGACY_NAV.map((item) => {
            const isChildActive = item.children.some(c => location === c.href || location.startsWith(c.href + "/"));
            const isOpen = openMenus.includes(item.key);
            return (
              <Collapsible key={item.key} open={isOpen} onOpenChange={() => toggleMenu(item.key)}>
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                      isChildActive ? "text-white shadow-md" : isOpen ? "text-sidebar-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                    style={isChildActive ? { background: themeColors.primary } : undefined}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </div>
                    <ChevronRight className={cn("h-3 w-3 transition-transform", isOpen && "rotate-90")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-0.5 pl-10 pr-2 mt-1">
                  {item.children.map(child => {
                    const isActive = location === child.href || location.startsWith(child.href + "/");
                    return (
                      <Link key={child.href} href={child.href}>
                        <div
                          className={cn(
                            "px-3 py-2 rounded-md text-sm cursor-pointer transition-colors",
                            isActive
                              ? "font-medium"
                              : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                          )}
                          style={isActive ? { color: themeColors.primary } : undefined}
                          onClick={() => setMobileOpen(false)}
                        >
                          {child.label}
                        </div>
                      </Link>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-1">
          <Link href="/dashboard">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer">
              <ArrowLeft className="h-4 w-4" />
              <span>กลับ E-Tax Center</span>
            </div>
          </Link>
          <div className="flex items-center gap-3 px-3 py-2 text-xs text-sidebar-foreground/50">
            <UserCircle className="h-4 w-4" />
            <span className="truncate">{user.fullName || user.username}</span>
          </div>
          <button
            onClick={() => logout()}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full"
          >
            <LogOut className="h-4 w-4" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className="flex-1 md:ml-64">
        <header className="h-14 bg-white border-b flex items-center px-4 gap-3 sticky top-0 z-10 shadow-sm">
          <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <FolderArchive className="h-4.5 w-4.5" style={{ color: themeColors.primary }} />
          <div className="text-sm font-medium text-slate-600">
            TRCloud Archive
          </div>
          {selectedCompany && (
            <span className="text-xs text-slate-400 ml-2">— {selectedCompany.name}</span>
          )}
        </header>
        <main className="p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function LegacyLayout({ children }: { children: React.ReactNode }) {
  return (
    <LegacyCompanyProvider>
      <LegacyLayoutInner>{children}</LegacyLayoutInner>
    </LegacyCompanyProvider>
  );
}
