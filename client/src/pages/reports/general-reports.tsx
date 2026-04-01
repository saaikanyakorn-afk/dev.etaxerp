import { useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Briefcase, Calculator, PieChart, Star, ExternalLink, Users, TrendingUp, Monitor, GraduationCap } from "lucide-react";
import { useLocation } from "wouter";

interface ReportItem {
  id: string;
  label: string;
  route?: string;
  status?: "active" | "coming";
  icon?: any;
}

interface ReportSection {
  title: string;
  subtitle: string;
  color: string;
  icon: any;
  category: string;
  items: ReportItem[];
}

const ALL_SECTIONS: ReportSection[] = [
  {
    title: "รายงานทางบัญชี",
    subtitle: "Frequently Used Accounting Reports",
    color: "bg-[var(--theme-primary)]",
    icon: FileText,
    category: "ทางบัญชี",
    items: [
      { id: "A1", label: "งบแสดงฐานะทางการเงิน (รายบัญชี)", route: "/reports/balance-sheet", status: "active" },
      { id: "A2", label: "งบทดลอง", route: "/reports/trial-balance", status: "active" },
      { id: "A3", label: "งบกำไรขาดทุน (รายบัญชี)", route: "/reports/income-statement", status: "active" },
      { id: "A4", label: "งบกระแสเงินสด", route: "/reports/cash-flow", status: "active" },
      { id: "A5", label: "บัญชีแยกประเภท", route: "/reports/general-ledger", status: "active" },
      { id: "A6", label: "รายงานสมุดบัญชีรายวัน", route: "/reports/journal-book", status: "active" },
      { id: "A7", label: "Statement ตามรหัสบัญชี", route: "/reports/account-statement", status: "active" },
      { id: "A7a", label: "Statement ตามรหัสบัญชี ตามคู่ค้า", route: "/reports/account-statement-contact", status: "active" },
      { id: "A8", label: "Reconcile - ตามคู่ค้า/รหัสบัญชี", route: "/reports/bank-reconciliation", status: "active" },
      { id: "A9", label: "Reconcile - ตามคู่ค้า/ประเภทบัญชี", route: "/reports/reconcile-account-type", status: "active" },
      { id: "A10", label: "กระดาษทำการ", route: "/reports/worksheet", status: "active" },
      { id: "A11", label: "หมายเหตุประกอบงบการเงิน", route: "/reports/financial-notes", status: "active" },
      { id: "A12", label: "งบการเงิน (ฉบับเต็ม) → Tax Tools", route: "/tax-tools/financial-statements-package", status: "active" },
    ]
  },
  {
    title: "รายงานสำหรับฝ่ายบริหาร",
    subtitle: "For Management",
    color: "bg-[#539BFF]",
    icon: Briefcase,
    category: "บริหาร",
    items: [
      { id: "BL1", label: "รายงานงบดุลเปรียบเทียบ (แสดง %)", route: "/reports/balance-sheet-compare", status: "active" },
      { id: "BL2", label: "รายงานงบดุลเปรียบเทียบ (จำนวนเงิน)", route: "/reports/balance-sheet-compare-amount", status: "active" },
      { id: "BL3", label: "รายงานงบดุลเปรียบเทียบ 12 เดือน (Plot)", route: "/reports/balance-sheet-12month-chart", status: "active" },
      { id: "PL1", label: "งบกำไร/ขาดทุนเปรียบเทียบ (แสดง %)", route: "/reports/income-statement-pct", status: "active" },
      { id: "PL2", label: "งบกำไร/ขาดทุนเปรียบเทียบ (จำนวนเงิน)", route: "/reports/income-statement-compare-amount", status: "active" },
      { id: "PL3", label: "งบกำไร/ขาดทุนเปรียบเทียบ 12 เดือน", route: "/reports/income-statement-12month", status: "active" },
      { id: "PL4", label: "งบกำไร/ขาดทุนเปรียบเทียบ 12 เดือน (Plot)", route: "/reports/income-statement-12month-chart", status: "active" },
      { id: "PL5", label: "งบกำไร/ขาดทุนเปรียบเทียบเดือน (สะสม)", route: "/reports/income-statement-cumulative", status: "active" },
      { id: "M2", label: "งบกำไร/ขาดทุนเปรียบเทียบ เดือน/ปี", route: "/reports/income-statement-month-year", status: "active" },
      { id: "M3", label: "งบกำไร/ขาดทุนเปรียบเทียบ (แสดง %)", route: "/reports/income-statement-compare", status: "active" },
      { id: "M4", label: "งบกำไร/ขาดทุนเปรียบเทียบรายไตรมาส", route: "/reports/income-statement-quarterly", status: "active" },
      { id: "BVA1", label: "ตั้งงบประมาณ", route: "/reports/budget-entry", status: "active" },
      { id: "BVA2", label: "งบประมาณ vs ยอดจริง", route: "/reports/budget-vs-actual", status: "active" },
    ]
  },
  {
    title: "รายงานภาษี",
    subtitle: "Tax Reports",
    color: "bg-[#fb9678]",
    icon: Calculator,
    category: "ภาษี",
    items: [
      { id: "T1", label: "รายงานภาษีขาย", route: "/sales/tax-report", status: "active" },
      { id: "T2", label: "รายงานภาษีซื้อ", route: "/purchases/tax-report", status: "active" },
      { id: "T2a", label: "รายงานภาษีซื้อยังไม่ถึงกำหนด", route: "/reports/purchase-tax-pending", status: "active" },
      { id: "T3", label: "รายงานภาษี ภพ 30", route: "/reports/vat-pp30", status: "active" },
      { id: "T4", label: "รายงานภาษีหัก ณ ที่จ่าย", route: "/purchases/wht", status: "active" },
      { id: "T5", label: "รายงาน ภงด 3", route: "/reports/pnd3", status: "active" },
      { id: "T6", label: "รายงาน ภงด 53", route: "/reports/pnd53", status: "active" },
      { id: "T7", label: "รายงานกระทบยอดภาษีขาย - งบทดลอง", route: "/reports/sales-tax-reconcile", status: "active", icon: Monitor },
      { id: "T8", label: "รายงานกระทบยอดภาษีซื้อ - งบทดลอง", route: "/reports/purchase-tax-reconcile", status: "active", icon: Monitor },
      { id: "T9", label: "รายงานภาษี ภพ 30 - จากงบทดลอง", route: "/reports/vat-pp30-from-tb", status: "active", icon: GraduationCap },
    ]
  },
  {
    title: "รายงานลูกหนี้ / เจ้าหนี้",
    subtitle: "AR/AP Reports",
    color: "bg-[#05b187]",
    icon: Users,
    category: "ลูกหนี้/เจ้าหนี้",
    items: [
      { id: "R1", label: "รายงาน AR Aging (ลูกหนี้จากใบกำกับภาษี)", route: "/reports/ar-aging", status: "active" },
      { id: "R1b", label: "รายงาน AR Aging (ลูกหนี้จากใบแจ้งหนี้)", route: "/reports/ar-aging-invoices", status: "active" },
      { id: "R2", label: "รายงาน AP Aging (เจ้าหนี้ค้างชำระ)", route: "/reports/ap-aging", status: "active" },
    ]
  },
  {
    title: "รายงานการขาย",
    subtitle: "Sales Activities",
    color: "bg-[#fec90f]",
    icon: PieChart,
    category: "บริหาร",
    items: [
      { id: "R2", label: "R2: ยอดขาย - ตามสินค้า/เอกสาร", route: "/reports/sales", status: "active" },
      { id: "R3", label: "R3: ยอดขาย - ตามลูกค้า/สินค้า", route: "/reports/sales", status: "active" },
      { id: "R4", label: "R4: ยอดขาย - ตามพนักงานขาย/เอกสาร", route: "/reports/sales", status: "active" },
      { id: "R5", label: "R5: ยอดขาย - ตามเอกสาร/สินค้า", route: "/reports/sales-by-document", status: "active" },
      { id: "R7", label: "R7: ยอดขาย - ตามแผนก/เอกสาร", route: "/reports/sales-by-department", status: "active" },
      { id: "R8", label: "R8: ยอดขาย - ตามโครงการ/เอกสาร", route: "/reports/sales-by-project", status: "active" },
      { id: "R9", label: "R9: ยอดขาย - ตามรหัสบัญชี/สินค้า", route: "/reports/sales-by-account", status: "active" },
      { id: "R10", label: "R10: รายละเอียดสินค้าในใบกำกับขาย", route: "/reports/sales-item-details", status: "active" },
      { id: "R11", label: "R11: กำไรขั้นต้น - ตามสินค้า/เอกสาร", route: "/reports/gross-profit", status: "active" },
      { id: "R12", label: "R12: ยอดขายรายวัน", route: "/reports/daily-sales", status: "active" },
      { id: "R13", label: "R13: Top สินค้าขายดี", route: "/reports/top-products", status: "active" },
      { id: "R14", label: "R14: ยอดขายเปรียบเทียบรายเดือน", route: "/reports/sales-monthly-comparison", status: "active" },
      { id: "R15", label: "R15: กำไรขั้นต้น - ตามสินค้า", route: "/reports/gross-profit-by-product", status: "active" },
    ]
  },
  {
    title: "รายงานวิเคราะห์ทางการเงิน",
    subtitle: "Financial Analytics",
    color: "bg-[#7c3aed]",
    icon: TrendingUp,
    category: "บริหาร",
    items: [
      { id: "FA1", label: "OPEX/CAPEX Analysis", route: "/reports/opex-capex", status: "active" },
      { id: "FA2", label: "Growth Trend Analysis", route: "/reports/growth-trend", status: "active" },
      { id: "FA3", label: "งบกำไรขาดทุนแยกตามแผนก (Dept P&L)", route: "/reports/department-pl", status: "active" },
      { id: "FA4", label: "Break-Even Analysis (จุดคุ้มทุน)", route: "/reports/break-even", status: "active" },
      { id: "FA5", label: "Financial Management Dashboard", route: "/reports/financial-management", status: "active" },
      { id: "FA6", label: "วิเคราะห์อัตราส่วนการเงิน (Financial Ratios)", route: "/reports/financial-ratios", status: "active" },
    ]
  },
  {
    title: "รายงานอื่นๆ",
    subtitle: "Other Reports",
    color: "bg-slate-500",
    icon: FileText,
    category: "ทางบัญชี",
    items: [
      { id: "O1", label: "Bank Reconciliation", route: "/reports/bank-reconciliation", status: "active" },
      { id: "O2", label: "รายงานภาษีหัก ณ ที่จ่าย", route: "/reports/wht", status: "active" },
      { id: "O3", label: "Log การบันทึกบัญชี", route: "/reports/accounting-log", status: "active" },
    ]
  }
];

const TABS = [
  { value: "all", label: "ทั้งหมด" },
  { value: "ทางบัญชี", label: "ทางบัญชี" },
  { value: "ภาษี", label: "ภาษี" },
  { value: "บริหาร", label: "บริหาร" },
  { value: "ลูกหนี้/เจ้าหนี้", label: "ลูกหนี้/เจ้าหนี้" },
];

export default function GeneralReports() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("all");

  const handleClick = (item: ReportItem, e: React.MouseEvent) => {
    if (!item.route || item.status === "coming") return;
    if (e.ctrlKey || e.metaKey) {
      window.open(item.route, "_blank");
    } else {
      navigate(item.route);
    }
  };

  const filteredSections = activeTab === "all"
    ? ALL_SECTIONS
    : ALL_SECTIONS.filter((s) => s.category === activeTab);

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-[#03c9d7]" />
            <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">รายงานต่างๆ</h1>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-amber-500">
            <Star className="h-3 w-3 fill-current" />
            <span>กด Ctrl + คลิกเพื่อเปิดรายงานใน TAB ใหม่</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-1.5 text-xs rounded-lg border transition-colors ${activeTab === tab.value ? "bg-slate-700 text-white border-slate-700" : "bg-slate-100 text-gray-600 border-gray-200 hover:bg-slate-200"}`}
              data-testid={`tab-${tab.value}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
          {filteredSections.map((section, idx) => (
            <Card key={`${section.title}-${idx}`} className="border-0 shadow-md overflow-hidden" data-testid={`card-section-${idx}`}>
              <CardHeader className="p-0">
                <div className="p-3 flex items-center gap-2">
                  <section.icon className="h-5 w-5 text-gray-500" />
                  <CardTitle className="text-sm font-bold">{section.title}</CardTitle>
                </div>
                <div className={`${section.color} py-1 text-center`}>
                  <span className="text-[10px] text-white uppercase font-medium tracking-wider">{section.subtitle}</span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-50">
                  {section.items.map((item) => (
                    <div
                      key={item.id}
                      className={`px-4 py-2.5 flex items-center gap-2 transition-colors ${item.route && item.status === "active" ? "hover:bg-[var(--theme-primary)]/10 cursor-pointer" : "opacity-60"}`}
                      onClick={(e) => handleClick(item, e)}
                      data-testid={`report-${item.id}`}
                    >
                      <span className="font-bold text-gray-400 min-w-[32px] text-xs">{item.id}:</span>
                      {item.icon && <item.icon className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                      <span className="text-sm text-gray-700 flex-1">{item.label}</span>
                      {item.status === "coming" ? (
                        <Badge className="text-[9px] bg-gray-100 text-gray-400 border-0 font-normal">เร็วๆ นี้</Badge>
                      ) : (
                        <ExternalLink className="h-3 w-3 text-gray-300" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
