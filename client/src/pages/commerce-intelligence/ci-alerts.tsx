import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import CILayout from "@/components/ci-layout";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import {
  BrainCircuit,
  AlertTriangle,
  TrendingDown,
  Package,
  Megaphone,
  RefreshCw,
  Search,
  Bell,
} from "lucide-react";
import CIExportButton from "./ci-export-button";

const SEVERITY_CONFIG = {
  red: { bg: "bg-red-50 border-red-200", text: "text-red-700", badge: "bg-red-100 text-red-800", icon: "text-red-500" },
  yellow: { bg: "bg-yellow-50 border-yellow-200", text: "text-yellow-700", badge: "bg-yellow-100 text-yellow-800", icon: "text-yellow-500" },
  blue: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", badge: "bg-blue-100 text-blue-800", icon: "text-blue-500" },
};

const TYPE_ICONS: Record<string, any> = {
  low_stock: Package,
  margin_decline: TrendingDown,
  high_roas_low_profit: Megaphone,
  refund_spike: RefreshCw,
  budget_overspend: Megaphone,
};

export default function CIAlerts() {
  const { selectedCompanyId } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/ci/alerts", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ci/alerts?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const alerts = data?.alerts || [];
  const filtered = alerts.filter((a: any) =>
    a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const countBySeverity = (sev: string) => alerts.filter((a: any) => a.severity === sev).length;

  return (
    <CILayout>
      <div className="space-y-6" data-testid="ci-alerts-page">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ background: "#667eea" }}>
              <Bell className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800" data-testid="text-alerts-title">แจ้งเตือนอัจฉริยะ</h1>
              <p className="text-sm text-muted-foreground">AI ตรวจจับความผิดปกติและโอกาสทางธุรกิจ</p>
            </div>
          </div>
          <CIExportButton
            fileName="CI-Alerts-Report"
            pdfTitle="Smart Alerts"
            kpis={[
              { label: "Critical", value: String(countBySeverity("red")) },
              { label: "Warning", value: String(countBySeverity("yellow")) },
              { label: "Suggestion", value: String(countBySeverity("blue")) },
              { label: "Total", value: String(alerts.length) },
            ]}
            tables={[{
              title: "All Alerts",
              sheetName: "Alerts",
              columns: [
                { header: "Severity", key: "severity", width: 10 },
                { header: "Type", key: "type", width: 18 },
                { header: "Title", key: "title", width: 30 },
                { header: "Message", key: "message", width: 50 },
              ],
              data: filtered,
            }]}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-red-700" data-testid="text-red-count">{countBySeverity("red")}</div>
                <div className="text-xs text-red-600">วิกฤต</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-yellow-200 bg-yellow-50/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-700" data-testid="text-yellow-count">{countBySeverity("yellow")}</div>
                <div className="text-xs text-yellow-600">เตือน</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <BrainCircuit className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-700" data-testid="text-blue-count">{countBySeverity("blue")}</div>
                <div className="text-xs text-blue-600">แนะนำ</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาแจ้งเตือน..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-alert-search"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BrainCircuit className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground" data-testid="text-no-alerts">ไม่มีแจ้งเตือนในขณะนี้</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((alert: any, idx: number) => {
              const config = SEVERITY_CONFIG[alert.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.blue;
              const Icon = TYPE_ICONS[alert.type] || AlertTriangle;
              return (
                <Card key={idx} className={`border ${config.bg}`} data-testid={`alert-card-${idx}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 ${config.icon}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-sm font-semibold ${config.text}`}>{alert.title}</span>
                          <Badge variant="outline" className={`text-[10px] ${config.badge}`}>
                            {alert.severity === "red" ? "วิกฤต" : alert.severity === "yellow" ? "เตือน" : "แนะนำ"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{alert.message}</p>
                        {alert.value !== undefined && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            ค่าปัจจุบัน: <span className="font-medium">{alert.value}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </CILayout>
  );
}
