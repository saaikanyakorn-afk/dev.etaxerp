import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SubscriptionNavButton } from "@/components/layout";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ShoppingCart,
  Menu,
  X,
  Building2,
  ChevronDown,
  ChevronRight,
  LogOut,
  ArrowLeft,
  Search,
  Star,
  BarChart3,
  PieChart,
  TrendingUp,
  Users,
  Clock,
  CreditCard,
  Package,
  Tag,
  Monitor,
  Store,
  Receipt,
  Heart,
  Warehouse,
  FileText,
  Settings,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

type NavChild = { label: string; href: string; icon?: any };

type NavItem = {
  label: string;
  icon: any;
  href: string;
  children?: NavChild[];
};

const POS_NAV: NavItem[] = [
  {
    label: "ภาพรวม", icon: LayoutDashboard, href: "/pos-hub/dashboard",
    children: [
      { label: "แดชบอร์ดยอดขาย", href: "/pos-hub/dashboard", icon: LayoutDashboard },
      { label: "สรุปรายวัน", href: "/pos-hub/daily-summary", icon: Receipt },
    ],
  },
  {
    label: "หน้าร้าน", icon: Monitor, href: "/pos/terminal",
    children: [
      { label: "เปิดหน้าจอขาย", href: "/pos/terminal", icon: Monitor },
      { label: "ประวัติกะขาย", href: "/pos/sessions", icon: Clock },
      { label: "รายการขาย", href: "/pos/sales", icon: ShoppingCart },
      { label: "จัดการสาขา", href: "/pos/branches", icon: Store },
    ],
  },
  {
    label: "สินค้า", icon: Package, href: "/pos/products",
    children: [
      { label: "รายการสินค้า", href: "/pos/products", icon: Package },
      { label: "จัดชุดสินค้า", href: "/pos/bundles", icon: Package },
    ],
  },
  {
    label: "คลังสินค้า", icon: Warehouse, href: "/pos/stock",
    children: [
      { label: "คลังหลัก / คลังสาขา", href: "/pos/stock", icon: Warehouse },
      { label: "ย้ายคลัง / กระจายสินค้า", href: "/pos/stock-transfer", icon: ShoppingCart },
      { label: "สต็อกการ์ด", href: "/pos/stock-card", icon: FileText },
    ],
  },
  {
    label: "เอกสาร", icon: FileText, href: "/pos/tax-invoices",
    children: [
      { label: "ใบกำกับภาษี", href: "/pos/tax-invoices", icon: FileText },
    ],
  },
  {
    label: "รายงานยอดขาย", icon: BarChart3, href: "/pos-hub/sales-by-branch",
    children: [
      { label: "ยอดขายแยกสาขา", href: "/pos-hub/sales-by-branch", icon: Store },
      { label: "ยอดขายแยกสินค้า", href: "/pos-hub/sales-by-product", icon: Package },
      { label: "ยอดขายแยกหมวด", href: "/pos-hub/sales-by-category", icon: Tag },
      { label: "สินค้าขายดี", href: "/pos-hub/best-sellers", icon: TrendingUp },
    ],
  },
  {
    label: "วิเคราะห์", icon: PieChart, href: "/pos-hub/payment-analysis",
    children: [
      { label: "ช่องทางชำระเงิน", href: "/pos-hub/payment-analysis", icon: CreditCard },
      { label: "ผลงานพนักงาน", href: "/pos-hub/cashier-performance", icon: Users },
      { label: "ช่วงเวลาขายดี", href: "/pos-hub/hourly-trends", icon: Clock },
    ],
  },
  {
    label: "ลูกค้า", icon: Heart, href: "/pos/loyalty",
    children: [
      { label: "สมาชิก / Loyalty", href: "/pos/loyalty", icon: Heart },
    ],
  },
  {
    label: "ตั้งค่า", icon: Settings, href: "/pos/settings",
    children: [
      { label: "ตั้งค่า POS", href: "/pos/settings", icon: Settings },
      { label: "จัดการพนักงาน", href: "/pos/staff", icon: Users },
      { label: "ค่าคอมมิชชั่น", href: "/pos/commission", icon: DollarSign },
    ],
  },
];

export default function PosLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, loading: authLoading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [switchTarget, setSwitchTarget] = useState<any>(null);
  const sidebarNavRef = useRef<HTMLElement>(null);
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { companies, selectedCompanyId, selectedCompany, setSelectedCompanyId, isAccountingFirm } = useCompany();

  const setPrimaryMutation = useMutation({
    mutationFn: async (companyId: number) => {
      const r = await fetch(`/api/companies/${companyId}/set-primary`, { method: "POST", credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
    },
  });

  const [companySearch, setCompanySearch] = useState("");
  const [companyPopoverOpen, setCompanyPopoverOpen] = useState(false);
  const filteredCompanies = companies.filter((c: any) =>
    c.name.toLowerCase().includes(companySearch.toLowerCase())
  );

  useEffect(() => {
    if (!authLoading && !user) setLocation("/login");
  }, [user, authLoading, setLocation]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  useEffect(() => {
    const parentWithActiveChild = POS_NAV.find(
      item => item.children?.some(child => location === child.href || (child.href !== "/" && location.startsWith(child.href + "/")))
    );
    if (parentWithActiveChild && !openMenus.includes(parentWithActiveChild.label)) {
      setOpenMenus(prev => [...prev, parentWithActiveChild.label]);
    }
  }, [location]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!sidebarNavRef.current) return;
      const allActive = sidebarNavRef.current.querySelectorAll('[data-sidebar-active="true"]');
      const activeEl = allActive[allActive.length - 1] as HTMLElement | null;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [location]);

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50/50 flex font-sans">
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          data-testid="mobile-menu-overlay"
        />
      )}

      <aside className={cn(
        "w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col fixed h-full z-50 shadow-sm print:!hidden transition-transform duration-200",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="flex items-center px-4 border-b border-sidebar-border shrink-0 relative overflow-hidden" style={{ background: "#03c9d7", height: "68px" }}>
          <Link href="/pos-hub/dashboard" className="flex items-center group cursor-pointer flex-1 justify-center relative z-10 gap-2">
            <Monitor className="h-6 w-6 text-white" />
            <span className="text-white font-bold text-lg" data-testid="text-pos-hub-title">POS ขายหน้าร้าน</span>
          </Link>
          <button
            className="md:hidden ml-2 p-1 rounded hover:bg-white/20 text-white relative z-10"
            onClick={() => setMobileMenuOpen(false)}
            data-testid="button-close-mobile-menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 shrink-0">
          {!isAccountingFirm ? (
            <div
              className="w-full flex items-center gap-2 px-3 py-2 bg-sidebar-accent/50 border border-sidebar-border rounded-md text-sidebar-foreground text-sm"
              data-testid="text-company-name"
            >
              <Building2 className="h-4 w-4 shrink-0" />
              <span className="truncate font-medium">{selectedCompany?.name || "บริษัทของฉัน"}</span>
            </div>
          ) : (
            <Popover open={companyPopoverOpen} onOpenChange={(open) => { setCompanyPopoverOpen(open); if (!open) setCompanySearch(""); }}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  data-testid="button-company-switcher"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Building2 className="h-4 w-4 shrink-0" />
                    <span className="truncate">{selectedCompany?.name || "เลือกบริษัท"}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0 bg-sidebar border-sidebar-border" align="start">
                <div className="p-2 border-b border-sidebar-border">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-sidebar-foreground/50" />
                    <Input
                      data-testid="input-company-search"
                      placeholder="ค้นหาบริษัท..."
                      value={companySearch}
                      onChange={e => setCompanySearch(e.target.value)}
                      className="pl-8 h-8 text-sm bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/40"
                    />
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto p-1">
                  {filteredCompanies.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-sidebar-foreground/50">ไม่พบบริษัท</div>
                  ) : (
                    filteredCompanies.map((company: any) => (
                      <div
                        key={company.id}
                        className={cn(
                          "flex items-center gap-1 px-3 py-2 text-sm rounded-md cursor-pointer transition-colors group",
                          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground",
                          selectedCompanyId === company.id && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        )}
                        data-testid={`menu-company-${company.id}`}
                      >
                        <button
                          className="flex-1 text-left truncate"
                          onClick={() => {
                            if (selectedCompanyId === company.id) { setCompanyPopoverOpen(false); setCompanySearch(""); return; }
                            setCompanyPopoverOpen(false); setCompanySearch(""); setSwitchTarget(company);
                          }}
                          data-testid={`button-select-company-${company.id}`}
                        >
                          {company.name}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setPrimaryMutation.mutate(company.id); }}
                          className={cn(
                            "shrink-0 p-0.5 rounded transition-colors",
                            company.isPrimary
                              ? "text-amber-400"
                              : "text-sidebar-foreground/30 hover:text-amber-400"
                          )}
                          title={company.isPrimary ? "บริษัทหลัก (สำนักงาน)" : "ตั้งเป็นบริษัทหลัก"}
                          data-testid={`button-set-primary-${company.id}`}
                        >
                          <Star className={cn("h-3.5 w-3.5", company.isPrimary && "fill-amber-400")} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>

        <nav ref={sidebarNavRef} className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-4 min-h-0">
          {POS_NAV.map((item) => {
            const isActive = location === item.href;

            if (item.children) {
              const isOpen = openMenus.includes(item.label);
              const isChildActive = item.children.some(child => location === child.href || (child.href !== "/" && location.startsWith(child.href + "/")));
              const toggleMenu = () => {
                setOpenMenus(prev =>
                  prev.includes(item.label) ? prev.filter(l => l !== item.label) : [...prev, item.label]
                );
              };
              return (
                <div key={item.label}>
                  <span
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
                      isChildActive
                        ? "text-white shadow-md"
                        : isOpen
                          ? "text-sidebar-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                    style={isChildActive ? { background: "#03c9d7" } : undefined}
                    data-sidebar-active={isChildActive ? "true" : undefined}
                    onClick={toggleMenu}
                    data-testid={`menu-pos-${item.label}`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="flex-1">{item.label}</span>
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </span>
                  {isOpen && (
                    <div className="ml-3 mt-0.5 space-y-0.5 border-l border-sidebar-border/50 pl-2">
                      {item.children.map(child => {
                        const childActive = location === child.href || (child.href !== "/" && location.startsWith(child.href + "/"));
                        const ChildIcon = child.icon;
                        return (
                          <Link key={child.href} href={child.href}>
                            <span
                              className={cn(
                                "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
                                childActive
                                  ? "bg-[#03c9d7]/15 text-[#03c9d7]"
                                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                              )}
                              data-sidebar-active={childActive ? "true" : undefined}
                              data-testid={`menu-pos-sub-${child.href.split("/").pop()}`}
                            >
                              {ChildIcon && <ChildIcon className="h-3.5 w-3.5" />}
                              {child.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link key={item.href} href={item.href}>
                <span
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
                    isActive
                      ? "text-white shadow-md"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                  style={isActive ? { background: "#03c9d7" } : undefined}
                  data-sidebar-active={isActive ? "true" : undefined}
                  data-testid={`menu-pos-${item.href.split("/").pop()}`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-3 shrink-0">
          <Link href="/">
            <span className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer border-2 border-[#03c9d7] text-[#03c9d7] hover:bg-[#03c9d7] hover:text-white" data-testid="link-back-home">
              <ArrowLeft className="h-4 w-4" />
              กลับหน้าหลัก E-Tax Center
            </span>
          </Link>
        </div>

        <div className="p-4 border-t border-sidebar-border shrink-0">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 bg-[#03c9d7]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold truncate" data-testid="text-user-name">{user.fullName}</p>
              <p className="text-xs text-sidebar-foreground/50 truncate">{user.role === "admin" ? "ผู้ดูแลระบบ" : user.role}</p>
            </div>
            <button
              onClick={logout}
              className="flexy-icon-btn flexy-icon-btn-error h-8 w-8 shrink-0"
              data-testid="button-logout"
              title="ออกจากระบบ"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 md:ml-64 flex flex-col min-h-screen print:!ml-0 overflow-x-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-4 md:px-6 sticky top-0 z-10 print:!hidden shadow-sm">
          <div className="flex items-center gap-2 md:gap-4 flex-1">
            <button
              className="md:hidden p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
              onClick={() => setMobileMenuOpen(true)}
              data-testid="button-open-mobile-menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-lg font-bold" style={{ color: "#03c9d7" }} data-testid="text-header-title">
              {selectedCompany ? selectedCompany.name : "POS ขายหน้าร้าน"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <SubscriptionNavButton />
          </div>
        </header>

        <div className="flex-1 p-4 w-full animate-in fade-in duration-500 print:!p-0">
          {children}
        </div>
      </main>

      {switchTarget && (
        <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center" data-testid="switch-company-dialog">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-3">เปลี่ยนบริษัท</h3>
            <p className="text-sm text-gray-600 mb-4">คุณต้องการเปลี่ยนไปใช้งานบริษัท</p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm font-semibold text-gray-800">{switchTarget.name}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setSwitchTarget(null)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors" data-testid="btn-switch-cancel">ยกเลิก</button>
              <button onClick={() => { const targetId = switchTarget.id; setSwitchTarget(null); setSelectedCompanyId(targetId); queryClient.invalidateQueries({ queryKey: ["/api/permissions/me"] }); queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }); setLocation("/pos-hub/dashboard"); }} className="flex-1 px-4 py-2.5 bg-[#03c9d7] hover:bg-[#03c9d7]/90 text-white rounded-lg text-sm font-semibold transition-colors" data-testid="btn-switch-confirm">ยืนยันเปลี่ยน</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
