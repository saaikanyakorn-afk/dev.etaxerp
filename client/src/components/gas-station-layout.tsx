import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SubscriptionNavButton } from "@/components/layout";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Fuel,
  Settings,
  ArrowLeft,
  Menu,
  X,
  Building2,
  ChevronDown,
  ChevronRight,
  LogOut,
  Bell,
  Search,
  Star,
  Container,
  Gauge,
  TrendingDown,
  Landmark,
  BarChart3,
  Truck,
  Droplets,
  Activity,
  CalendarDays,
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

const GAS_STATION_NAV: NavItem[] = [
  { label: "ภาพรวม", icon: LayoutDashboard, href: "/gas-station/dashboard" },
  {
    label: "ยอดขาย", icon: CalendarDays, href: "/gas-station/daily-sales",
    children: [
      { label: "ยอดขายรายวัน", href: "/gas-station/daily-sales", icon: CalendarDays },
    ],
  },
  {
    label: "สต็อกน้ำมัน", icon: Container, href: "/gas-station/fuel-stock",
    children: [
      { label: "รับน้ำมัน / จุ่มถัง / คงเหลือ", href: "/gas-station/fuel-stock", icon: Truck },
      { label: "Oil Loss/Gain", href: "/gas-station/oil-loss-gain", icon: Activity },
    ],
  },
  {
    label: "ภาษี", icon: Landmark, href: "/gas-station/local-tax",
    children: [
      { label: "ภาษีท้องถิ่น / อบจ.01-4 / 01-6", href: "/gas-station/local-tax", icon: Landmark },
    ],
  },
  {
    label: "รายงาน", icon: BarChart3, href: "/gas-station/reports",
    children: [
      { label: "รายงานรวม", href: "/gas-station/reports", icon: BarChart3 },
    ],
  },
  {
    label: "ตั้งค่า", icon: Settings, href: "/gas-station/setup",
    children: [
      { label: "ชนิดน้ำมัน / ตู้จ่าย / ถัง", href: "/gas-station/setup", icon: Fuel },
      { label: "เชื่อมต่อระบบปั๊ม", href: "/gas-station/integration", icon: Settings },
    ],
  },
];

const HUB_COLOR = "#05b187";

export default function GasStationLayout({ children }: { children: React.ReactNode }) {
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
    const parentWithActiveChild = GAS_STATION_NAV.find(
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
    <>
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
        <div className="flex items-center px-4 border-b border-sidebar-border shrink-0 relative overflow-hidden" style={{ background: HUB_COLOR, height: "68px" }}>
          <Link href="/gas-station/daily-sales" className="flex items-center group cursor-pointer flex-1 justify-center relative z-10 gap-2">
            <Fuel className="h-6 w-6 text-white" />
            <span className="text-white font-bold text-lg" data-testid="text-gas-station-title">Gas Station Hub</span>
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
                <div className="border-t border-sidebar-border px-3 py-1.5 flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[9px] font-bold text-white" style={{ background: "#fec90f" }}>{companies.length}</span>
                  <span className="text-[10px] text-sidebar-foreground/40">บริษัท</span>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>

        <nav ref={sidebarNavRef} className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-4 min-h-0">
          {GAS_STATION_NAV.map((item) => {
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
                    style={isChildActive ? { background: HUB_COLOR } : undefined}
                    data-sidebar-active={isChildActive ? "true" : undefined}
                    onClick={toggleMenu}
                    data-testid={`menu-gas-${item.label}`}
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
                                  ? `bg-[${HUB_COLOR}]/15 text-[${HUB_COLOR}]`
                                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                              )}
                              style={childActive ? { background: `${HUB_COLOR}20`, color: HUB_COLOR } : undefined}
                              data-sidebar-active={childActive ? "true" : undefined}
                              data-testid={`menu-gas-sub-${child.href.split("/").pop()}`}
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
                  style={isActive ? { background: HUB_COLOR } : undefined}
                  data-sidebar-active={isActive ? "true" : undefined}
                  data-testid={`menu-gas-${item.href.split("/").pop()}`}
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
            <span className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer border-2 border-[#fb9678] text-[#fb9678] hover:bg-[#fb9678] hover:text-white" data-testid="link-back-home">
              <ArrowLeft className="h-4 w-4" />
              กลับหน้าหลัก E-Tax Center
            </span>
          </Link>
        </div>

        <div className="p-4 border-t border-sidebar-border shrink-0">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0" style={{ background: HUB_COLOR }}>
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

      <main className="flex-1 md:ml-64 flex flex-col min-h-screen print:!ml-0">
        <header className="h-16 bg-white border-b flex items-center justify-between px-4 md:px-6 sticky top-0 z-10 print:!hidden shadow-sm">
          <div className="flex items-center gap-2 md:gap-4 flex-1">
            <button
              className="md:hidden p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
              onClick={() => setMobileMenuOpen(true)}
              data-testid="button-open-mobile-menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <Fuel className="h-5 w-5" style={{ color: HUB_COLOR }} />
              <span className="text-lg font-bold" style={{ color: HUB_COLOR }} data-testid="text-header-title">Gas Station Hub</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <SubscriptionNavButton />
            <button
              className="h-10 w-10 rounded-full flex items-center justify-center relative transition-colors hover:bg-[#fffbf0]"
              style={{ color: "#fec90f" }}
              data-testid="button-notifications"
            >
              <Bell className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 p-4 w-full animate-in fade-in duration-500 print:!p-0 overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
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
            <button onClick={() => { const targetId = switchTarget.id; setSwitchTarget(null); setSelectedCompanyId(targetId); queryClient.invalidateQueries({ queryKey: ["/api/permissions/me"] }); queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }); setLocation("/gas-station/daily-sales"); }} className="flex-1 px-4 py-2.5 text-white rounded-lg text-sm font-semibold transition-colors" style={{ background: HUB_COLOR }} data-testid="btn-switch-confirm">ยืนยันเปลี่ยน</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
