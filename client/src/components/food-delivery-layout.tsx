import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SubscriptionNavButton } from "@/components/layout";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingCart,
  Store,
  Link2,
  Settings,
  ArrowLeft,
  Menu,
  X,
  Building2,
  ChevronDown,
  LogOut,
  Bell,
  Search,
  Star,
  BarChart3,
  ClipboardList,
  FileSpreadsheet,
  Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

type NavItem = {
  label: string;
  icon: any;
  href: string;
};

const FOOD_NAV: NavItem[] = [
  { label: "ภาพรวม", icon: LayoutDashboard, href: "/food-delivery/dashboard" },
  { label: "ออเดอร์อาหาร", icon: ShoppingCart, href: "/food-delivery/orders" },
  { label: "นำเข้า Excel", icon: FileSpreadsheet, href: "/food-delivery/import" },
  { label: "บัญชี & ใบกำกับ", icon: Calculator, href: "/food-delivery/accounting" },
  { label: "จัดการเมนู", icon: UtensilsCrossed, href: "/food-delivery/menu" },
  { label: "เชื่อมต่อแพลตฟอร์ม", icon: Link2, href: "/food-delivery/connections" },
  { label: "รายการร้าน", icon: Store, href: "/food-delivery/stores" },
  { label: "วิเคราะห์ยอดขาย", icon: BarChart3, href: "/food-delivery/analytics" },
  { label: "ประวัติออเดอร์", icon: ClipboardList, href: "/food-delivery/history" },
  { label: "ตั้งค่า", icon: Settings, href: "/food-delivery/settings" },
];

export default function FoodDeliveryLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, loading: authLoading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [switchTarget, setSwitchTarget] = useState<any>(null);
  const sidebarNavRef = useRef<HTMLElement>(null);
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
    const timer = setTimeout(() => {
      if (!sidebarNavRef.current) return;
      const activeEl = sidebarNavRef.current.querySelector('[data-sidebar-active="true"]') as HTMLElement | null;
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
        <div className="flex items-center px-4 border-b border-sidebar-border shrink-0 relative overflow-hidden" style={{ background: "#05b187", height: "68px" }}>
          <Link href="/food-delivery/dashboard" className="flex items-center group cursor-pointer flex-1 justify-center relative z-10 gap-2">
            <UtensilsCrossed className="h-6 w-6 text-white" />
            <span className="text-white font-bold text-lg" data-testid="text-food-delivery-title">Food Delivery</span>
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

        <nav ref={sidebarNavRef} className="flex-1 overflow-y-auto px-2 space-y-1 pb-4 min-h-0">
          {FOOD_NAV.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <span
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
                    isActive
                      ? "text-white shadow-md"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                  style={isActive ? { background: "#05b187" } : undefined}
                  data-sidebar-active={isActive ? "true" : undefined}
                  data-testid={`menu-food-${item.href.split("/").pop()}`}
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
            <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "#05b187" }}>
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
            <span className="text-lg font-bold" style={{ color: "#05b187" }} data-testid="text-header-title">Food Delivery</span>
          </div>
          <div className="flex items-center gap-1">
            <SubscriptionNavButton />
            <button
              className="h-10 w-10 rounded-full flex items-center justify-center relative transition-colors hover:bg-[#e8f8f2]"
              style={{ color: "#fec90f" }}
              data-testid="button-notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full border-2 border-white" style={{ background: "#f94d4d" }} />
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
            <button onClick={() => { const targetId = switchTarget.id; setSwitchTarget(null); setSelectedCompanyId(targetId); queryClient.invalidateQueries({ queryKey: ["/api/permissions/me"] }); queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }); setLocation("/food-delivery/dashboard"); }} className="flex-1 px-4 py-2.5 bg-[#fb9678] hover:bg-[#fb9678]/90 text-white rounded-lg text-sm font-semibold transition-colors" data-testid="btn-switch-confirm">ยืนยันเปลี่ยน</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
