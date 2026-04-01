import { useLocation } from "wouter";
import { BarChart3, BookOpen, FileText, Scale, ClipboardList } from "lucide-react";

const REPORT_TABS = [
  { path: "/reports/trial-balance", label: "งบทดลอง", icon: ClipboardList },
  { path: "/reports/income-statement", label: "งบกำไรขาดทุน (รายบัญชี)", icon: BarChart3 },
  { path: "/reports/balance-sheet", label: "งบดุล (รายบัญชี)", icon: Scale },
  { path: "/reports/general-ledger", label: "แยกประเภท", icon: BookOpen },
  { path: "/reports/worksheet", label: "กระดาษทำการ", icon: FileText },
];

export default function ReportNavTabs() {
  const [location, navigate] = useLocation();

  return (
    <div className="flex items-center gap-1 bg-slate-50 border rounded-lg p-1 mb-4" data-testid="report-nav-tabs">
      {REPORT_TABS.map(tab => {
        const isActive = location === tab.path || location.startsWith(tab.path + "?");
        const Icon = tab.icon;
        return (
          <button
            key={tab.path}
            type="button"
            data-testid={`tab-${tab.path.split("/").pop()}`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? "bg-white text-[var(--theme-primary)] shadow-sm border border-slate-200"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            }`}
            onClick={() => {
              if (!isActive) navigate(tab.path);
            }}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
