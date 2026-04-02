import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SubscriptionNavButton } from "@/components/layout";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileSpreadsheet,
  ShoppingCart,
  FileText,
  Link2,
  Settings,
  ArrowLeft,
  Globe,
  Menu,
  X,
  Building2,
  ChevronDown,
  ChevronRight,
  LogOut,
  Bell,
  Search,
  Star,
  Box,
  Package,
  Layers,
  Gift,
  Warehouse,
  CreditCard,
  RefreshCw,
  BarChart3,
  TrendingDown,
  ClipboardList,
  ClipboardCheck,
  PieChart,
  Truck,
  Tag,
  MessageCircle,
  Zap,
  Code,
  MessagesSquare,
  Radio,
  Key,
  ScanLine,
  Camera,
  Video,
  MapPin,
  Waves,
  Smartphone,
  Brain,
  BotMessageSquare,
  Users,
  FileCheck,
  Receipt,
  ReceiptText,
  FileBadge,
  Sparkles,
  Calculator,
  Upload,
  MessageSquare,
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

const ECOMMERCE_NAV: NavItem[] = [
  {
    label: "ภาพรวม", icon: LayoutDashboard, href: "/ecommerce/dashboard",
    children: [
      { label: "แดชบอร์ด", href: "/ecommerce/dashboard", icon: LayoutDashboard },
      { label: "Business Insights", href: "/ecommerce/business-insights", icon: BarChart3 },
    ],
  },
  {
    label: "ออเดอร์ & การขาย", icon: ShoppingCart, href: "/ecommerce/orders",
    children: [
      { label: "คำสั่งซื้อทั้งหมด", href: "/ecommerce/orders", icon: ShoppingCart },
      { label: "นำเข้าออเดอร์", href: "/ecommerce/import", icon: FileSpreadsheet },
      { label: "เอกสารทางภาษี", href: "/ecommerce/documents", icon: FileText },
      { label: "คืนสินค้า/คืนเงิน", href: "/ecommerce/returns", icon: RefreshCw },
      { label: "รับคืนสินค้า (Scan)", href: "/ecommerce/returns-scan", icon: ScanLine },
      { label: "ตรวจสอบ QC", href: "/ecommerce/returns-qc", icon: ClipboardCheck },
      { label: "รายงานสินค้าคืน", href: "/ecommerce/returns-report", icon: BarChart3 },
      { label: "ไลฟ์ขายของ", href: "/ecommerce/live-selling", icon: Radio },
      { label: "คอมมิชชั่นไลฟ์", href: "/ecommerce/live-commission", icon: DollarSign },
      { label: "Lucky Draw จับรางวัล", href: "/ecommerce/live-selling/lucky-draw", icon: Gift },
    ],
  },
  {
    label: "เอกสารขาย", icon: FileCheck, href: "/ecommerce/quick-invoice",
    children: [
      { label: "ออกบิลหน้าร้าน [WK]", href: "/ecommerce/quick-invoice", icon: ReceiptText },
      { label: "ใบเสนอราคา [QO]", href: "/ecommerce/quotes", icon: FileText },
      { label: "ใบกำกับภาษี [TIV]", href: "/ecommerce/documents", icon: FileCheck },
    ],
  },
  {
    label: "AI Live Agency", icon: Brain, href: "/ecommerce/live-agency",
    children: [
      { label: "ภาพรวม Agency", href: "/ecommerce/live-agency", icon: LayoutDashboard },
      { label: "วางแผนไลฟ์", href: "/ecommerce/live-agency/planning", icon: ClipboardList },
      { label: "มอนิเตอร์ไลฟ์", href: "/ecommerce/live-agency", icon: Radio },
      { label: "รายงานหลังไลฟ์", href: "/ecommerce/live-agency", icon: BarChart3 },
    ],
  },
  {
    label: "สินค้า & สต็อก", icon: Box, href: "/ecommerce/inventory",
    children: [
      { label: "สรุปรายการสินค้า", href: "/ecommerce/inventory", icon: Package },
      { label: "สูตรผลิต (BOM)", href: "/ecommerce/inventory/bom", icon: Layers },
      { label: "ใบสั่งผลิต", href: "/ecommerce/inventory/manufacturing", icon: ClipboardList },
      { label: "สินค้าจัดชุด", href: "/ecommerce/inventory/bundles", icon: Gift },
      { label: "โปรโมชั่น", href: "/ecommerce/inventory/promotions", icon: CreditCard },
      { label: "คลังสินค้า", href: "/ecommerce/inventory/warehouse", icon: Warehouse },
      { label: "มูลค่าคงเหลือ", href: "/ecommerce/inventory/valuation", icon: BarChart3 },
      { label: "สรุปการเคลื่อนไหว", href: "/ecommerce/inventory/movement", icon: RefreshCw },
      { label: "สินค้าเคลื่อนไหวช้า", href: "/ecommerce/inventory/slow-moving", icon: TrendingDown },
      { label: "ตำแหน่งจัดเก็บ (Bin)", href: "/ecommerce/bin-locations", icon: MapPin },
      { label: "ซิงค์สต๊อกแพลตฟอร์ม", href: "/ecommerce/inventory/stock-sync", icon: RefreshCw },
      { label: "จัดการคลังสินค้า", href: "/ecommerce/warehouses", icon: Warehouse },
      { label: "จับคู่ SKU อัจฉริยะ", href: "/ecommerce/sku-mapping", icon: Sparkles },
      { label: "แจ้งเตือนสต๊อก", href: "/ecommerce/stock-alerts", icon: Bell },
    ],
  },
  {
    label: "จัดส่ง", icon: Truck, href: "/ecommerce/fulfillment",
    children: [
      { label: "จัดส่งสินค้า (Pick-Pack-Ship)", href: "/ecommerce/fulfillment", icon: Truck },
      { label: "Wave Picking", href: "/ecommerce/wave-picking", icon: Waves },
      { label: "PDA มือถือ", href: "/ecommerce/pda-mobile", icon: Smartphone },
      { label: "การจัดการรายการจัดส่ง", href: "/ecommerce/shipping-labels", icon: Tag },
      { label: "สถานีแพ็คสินค้า (CCTV)", href: "/ecommerce/packing-station", icon: Camera },
      { label: "ประวัติวิดีโอการแพ็ค", href: "/ecommerce/packing-recordings", icon: Video },
    ],
  },
  {
    label: "การเงิน", icon: CreditCard, href: "/ecommerce/settlements",
    children: [
      { label: "ตรวจสอบการรับเงิน", href: "/ecommerce/settlements", icon: CreditCard },
      { label: "นำเข้า Settlement", href: "/ecommerce/settlement-import", icon: Upload },
      { label: "ตรวจสอบใบกำกับภาษี", href: "/ecommerce/reconciliation", icon: ClipboardCheck },
      { label: "วิเคราะห์ยอดขาย", href: "/ecommerce/analytics", icon: PieChart },
      { label: "คำนวณราคาขาย", href: "/ecommerce/price-calculator", icon: Calculator },
      { label: "AI Analytics", href: "/ecommerce/ai-analytics", icon: Brain },
    ],
  },
  {
    label: "ช่องทาง & เชื่อมต่อ", icon: Globe, href: "/ecommerce/connections",
    children: [
      { label: "เชื่อมต่อแพลตฟอร์ม", href: "/ecommerce/connections", icon: Globe },
      { label: "ซิงค์อัตโนมัติ", href: "/ecommerce/auto-sync", icon: Zap },
      { label: "ดูดออเดอร์ Facebook", href: "/ecommerce/facebook-orders", icon: MessagesSquare },
      { label: "Open API (เว็บไซต์)", href: "/ecommerce/api-connect", icon: Code },
      { label: "แชทรวม", href: "/ecommerce/chat", icon: MessageCircle },
      { label: "ตอบกลับอัตโนมัติ", href: "/ecommerce/chat/auto-reply", icon: BotMessageSquare },
      { label: "คีย์เวิร์ดจับออเดอร์", href: "/ecommerce/chat/keywords", icon: MessageCircle },
    ],
  },
  {
    label: "ตั้งค่า", icon: Settings, href: "/ecommerce/settings",
    children: [
      { label: "ตั้งค่าทั่วไป", href: "/ecommerce/settings", icon: Settings },
      { label: "ทีมงาน E-Commerce", href: "/ecommerce/team", icon: Users },
      { label: "API Credentials", href: "/ecommerce/platform-credentials", icon: Key },
      { label: "ตั้งค่ากล้อง CCTV", href: "/ecommerce/packing-cameras", icon: Camera },
      { label: "Supplier Portal", href: "/ecommerce/supplier-portal", icon: Key },
      { label: "เชื่อมสำนักงานบัญชี", href: "/settings/firm-link", icon: Link2 },
    ],
  },
];

export default function EcommerceLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, loading: authLoading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [switchTarget, setSwitchTarget] = useState<any>(null);
  const sidebarNavRef = useRef<HTMLElement>(null);
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { companies, selectedCompanyId, selectedCompany, setSelectedCompanyId, isAccountingFirm } = useCompany();

  const { data: lowStockData } = useQuery<{ length: number }>({
    queryKey: ["/api/ecommerce/low-stock", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/low-stock?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
    refetchInterval: 600000,
    staleTime: 300000,
  });
  const lowStockCount = Array.isArray(lowStockData) ? lowStockData.length : 0;

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
    const parentWithActiveChild = ECOMMERCE_NAV.find(
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
        <div className="flex items-center px-4 border-b border-sidebar-border shrink-0 relative overflow-hidden" style={{ background: "#fb9678", height: "68px" }}>
          <Link href="/ecommerce/orders" className="flex items-center group cursor-pointer flex-1 justify-center relative z-10 gap-2">
            <Globe className="h-6 w-6 text-white" />
            <span className="text-white font-bold text-lg" data-testid="text-ecommerce-title">eCommerce Hub</span>
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
          {ECOMMERCE_NAV.map((item) => {
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
                    style={isChildActive ? { background: "#fb9678" } : undefined}
                    data-sidebar-active={isChildActive ? "true" : undefined}
                    onClick={toggleMenu}
                    data-testid={`menu-ecommerce-${item.label}`}
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
                                  ? "bg-[#fb9678]/15 text-[#fb9678]"
                                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                              )}
                              data-sidebar-active={childActive ? "true" : undefined}
                              data-testid={`menu-ecommerce-sub-${child.href.split("/").pop()}`}
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
                  style={isActive ? { background: "#fb9678" } : undefined}
                  data-sidebar-active={isActive ? "true" : undefined}
                  data-testid={`menu-ecommerce-${item.href.split("/").pop()}`}
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
            <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 bg-[#fb9678]">
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
            <span className="text-lg font-bold" style={{ color: "#fb9678" }} data-testid="text-header-title">
              {selectedCompany ? selectedCompany.name : "eCommerce Hub"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <SubscriptionNavButton />
            <button
              className="h-10 w-10 rounded-full flex items-center justify-center relative transition-colors hover:bg-[#fff3ef]"
              onClick={() => setLocation("/ecommerce/stock-alerts")}
              title="แจ้งเตือนสต๊อกสินค้า"
              data-testid="button-stock-alerts"
            >
              <Warehouse className="h-5 w-5" style={{ color: lowStockCount > 0 ? "#f94d4d" : "#05b187" }} />
              {lowStockCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white"
                  style={{ background: "#f94d4d" }}
                  data-testid="badge-low-stock-count"
                >
                  {lowStockCount > 99 ? "99+" : lowStockCount}
                </span>
              )}
            </button>
            <button
              className="h-10 w-10 rounded-full flex items-center justify-center relative transition-colors hover:bg-[#fffbf0]"
              style={{ color: "#fec90f" }}
              data-testid="button-notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full border-2 border-white" style={{ background: "#f94d4d" }} />
            </button>
          </div>
        </header>

        <div className="flex-1 p-4 w-full animate-in fade-in duration-500 print:!p-0">
          {children}
        </div>
      </main>
    </div>
    <FloatingChatButton />
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
            <button onClick={() => { const targetId = switchTarget.id; setSwitchTarget(null); setSelectedCompanyId(targetId); queryClient.invalidateQueries({ queryKey: ["/api/permissions/me"] }); queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }); setLocation("/ecommerce/dashboard"); }} className="flex-1 px-4 py-2.5 bg-[#fb9678] hover:bg-[#fb9678]/90 text-white rounded-lg text-sm font-semibold transition-colors" data-testid="btn-switch-confirm">ยืนยันเปลี่ยน</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function FloatingChatButton() {
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const { selectedCompanyId } = useCompany();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem("chat-fab-pos");
      if (saved) return JSON.parse(saved);
    } catch {}
    return { x: window.innerWidth - 80, y: window.innerHeight - 96 };
  });
  const dragStart = useRef<{ startX: number; startY: number; btnX: number; btnY: number } | null>(null);
  const moved = useRef(false);

  const { data } = useQuery({
    queryKey: ["/api/ecommerce/chat/unread-total", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return { count: 0 };
      const res = await fetch(`/api/ecommerce/chat/unread-total?companyId=${selectedCompanyId}`);
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    refetchInterval: 30000,
    enabled: !!selectedCompanyId,
  });

  const unreadCount = data?.count || 0;

  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

  const handlePointerDown = (e: React.PointerEvent) => {
    dragStart.current = { startX: e.clientX, startY: e.clientY, btnX: pos.x, btnY: pos.y };
    moved.current = false;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.startX;
    const dy = e.clientY - dragStart.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
    const newX = clamp(dragStart.current.btnX + dx, 0, window.innerWidth - 56);
    const newY = clamp(dragStart.current.btnY + dy, 0, window.innerHeight - 56);
    setPos({ x: newX, y: newY });
  };

  const handlePointerUp = () => {
    if (dragStart.current) {
      localStorage.setItem("chat-fab-pos", JSON.stringify(pos));
    }
    dragStart.current = null;
    setDragging(false);
    if (!moved.current) {
      setLocation("/ecommerce/chat");
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setPos(prev => ({
        x: clamp(prev.x, 0, window.innerWidth - 56),
        y: clamp(prev.y, 0, window.innerHeight - 56),
      }));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (location.startsWith("/ecommerce/chat")) return null;

  return (
    <button
      ref={btnRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="fixed z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center print:hidden select-none touch-none"
      style={{
        background: "linear-gradient(135deg, #0695FF 0%, #A334FA 50%, #FF6968 100%)",
        left: pos.x,
        top: pos.y,
        cursor: dragging ? "grabbing" : "grab",
        transition: dragging ? "none" : "box-shadow 0.2s",
        boxShadow: dragging ? "0 8px 25px rgba(0,0,0,0.3)" : "0 4px 12px rgba(0,0,0,0.15)",
      }}
      data-testid="button-floating-chat"
      title="แชทรวม — ลากเพื่อย้ายตำแหน่ง"
    >
      <svg viewBox="0 0 28 28" className="w-7 h-7 pointer-events-none" fill="white">
        <path d="M14 2.042c-6.76 0-12 4.952-12 11.64 0 3.72 1.632 6.924 4.2 9.072V27l4.08-2.244c1.14.312 2.352.492 3.72.492 6.76 0 12-4.952 12-11.64S20.76 2.042 14 2.042zm1.2 15.66l-3.06-3.264-5.964 3.264L12.3 11.1l3.132 3.264 5.892-3.264-6.124 6.6z" />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center px-1 pointer-events-none">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}
