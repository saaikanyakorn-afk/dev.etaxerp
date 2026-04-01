import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Wand2, 
  Scissors, 
  Search, 
  Files, 
  Settings2, 
  Wrench, 
  Zap, 
  Anchor, 
  BookOpen,
  Receipt,
  FileX,
  FileSpreadsheet
} from "lucide-react";
import { useLocation } from "wouter";

const MGMT_TOOLS = [
  { label: "ยกยอดงบการเงิน", icon: Wand2, color: "bg-[var(--theme-primary)]", href: "/accounting-mgmt/balance-carry-forward" },
  { label: "นำเข้างบทดลองเปรียบเทียบ", icon: FileSpreadsheet, color: "bg-[#539BFF]", href: "/accounting-mgmt/trial-balance-compare" },
  { label: "TRIM DATA", icon: Scissors, color: "bg-rose-500", href: "/accounting-mgmt/trim-data" },
  { label: "ตรวจสอบการลงบัญชี", icon: Search, color: "bg-[#05b187]", href: "/accounting-mgmt/journal-validation" },
  { label: "ค้นหารายการบัญชีซ้ำ", icon: Files, color: "bg-[#8b5cf6]", href: "/accounting-mgmt/duplicate-detection" },
  { label: "ปิดบัญชี VAT", icon: Receipt, color: "bg-[#fb9678]", href: "/accounting-mgmt/vat-closing" },
  { label: "ปิดบัญชี", icon: Settings2, color: "bg-[#03c9d7]", href: "/accounting-mgmt/period-closing" },
  { label: "ล้างข้อมูลรายการบัญชี 0", icon: Wrench, color: "bg-amber-400", href: "/accounting-mgmt/clean-zero" },
  { label: "Fix Diff ( 0.01 > x > 0.0001 )", icon: Zap, color: "bg-slate-800", href: "/accounting-mgmt/fix-diff" },
  { label: "Change Anchor", icon: Anchor, color: "bg-[#64748b]", href: "/accounting-mgmt/change-anchor" },
  { label: "GL NO DOC", icon: BookOpen, color: "bg-[#fec90f]", href: "/accounting-mgmt/gl-no-doc" },
  { label: "ค้นหา GL ไม่มีเอกสาร", icon: FileX, color: "bg-[#f94d4d]", href: "/accounting-mgmt/orphan-journal" },
];

export default function AccountingMgmt() {
  const [, navigate] = useLocation();

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="h-4 w-4" />
          <h1 className="text-xl font-heading font-bold text-foreground">การจัดการบัญชี</h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {MGMT_TOOLS.map((tool) => (
            <Card
              key={tool.label}
              className="overflow-hidden border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => tool.href && navigate(tool.href)}
              data-testid={`card-tool-${tool.label}`}
            >
              <CardContent className="p-0">
                <div className={`${tool.color} h-32 flex items-center justify-center text-white transition-transform group-hover:scale-105 duration-300`}>
                  <tool.icon className="h-12 w-12 stroke-[1.5]" />
                </div>
                <div className="p-4 text-center bg-white">
                  <span className="text-sm font-medium text-slate-600">{tool.label}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
