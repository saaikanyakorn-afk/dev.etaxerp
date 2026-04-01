import { ReactNode } from "react";
import { X } from "lucide-react";
import { useLocation } from "wouter";
import { useThemeColor } from "@/hooks/use-theme-color";
import Layout from "./layout";
import ReportNavTabs from "./report-nav-tabs";

interface ReportLayoutProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  backTo?: string;
  showNavTabs?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

export default function ReportLayout({ title, subtitle = "รายงาน", icon, backTo = "/reports/general", showNavTabs = false, fullWidth = false, children }: ReportLayoutProps) {
  const { colors: themeColors } = useThemeColor();
  const [, navigate] = useLocation();

  if (fullWidth) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div
          className="sticky top-0 z-50 flex items-center justify-between px-4 py-2 shadow-sm"
          style={{ background: themeColors.primary, color: "#fff" }}
        >
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-semibold text-base">{title}</span>
            <span className="text-white/70 text-sm">{subtitle}</span>
          </div>
          <button
            onClick={() => navigate(backTo)}
            className="rounded-full p-1.5 bg-white/90 hover:bg-white transition-colors"
            data-testid="button-close-report"
            title="ปิดรายงาน"
          >
            <X className="h-5 w-5 text-red-500" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {showNavTabs && <ReportNavTabs />}
          {children}
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="space-y-4">
        {showNavTabs && <ReportNavTabs />}
        {children}
      </div>
    </Layout>
  );
}
