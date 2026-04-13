import ManufacturingLayout from "@/components/manufacturing-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Barcode, Search, Wrench, ClipboardList, Package, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";

export default function ManufacturingDashboard() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  const { data: stats } = useQuery({
    queryKey: ["/api/manufacturing-module/dashboard-stats", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/manufacturing-module/dashboard-stats?companyId=${companyId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!companyId,
  });

  const { data: alerts } = useQuery({
    queryKey: ["/api/manufacturing-module/calibration-alerts", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/manufacturing-module/calibration-alerts?companyId=${companyId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!companyId,
  });

  const cards = [
    { label: "Serial ทั้งหมด", value: stats?.totalSerials || 0, icon: Barcode, color: "#03c9d7" },
    { label: "พร้อมใช้งาน", value: stats?.availableSerials || 0, icon: Package, color: "#05b187" },
    { label: "ประกอบแล้ว", value: stats?.assembledSerials || 0, icon: ClipboardList, color: "#fb9678" },
    { label: "สินค้าสำเร็จรูป", value: stats?.finishedGoods || 0, icon: Package, color: "#539BFF" },
    { label: "Traceability Records", value: stats?.traceabilityRecords || 0, icon: Search, color: "#fec90f" },
    { label: "สูตร BOM", value: stats?.bomCount || 0, icon: ClipboardList, color: "#03c9d7" },
  ];

  return (
    <ManufacturingLayout>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">ภาพรวมระบบผลิต</h1>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {cards.map((c, i) => {
            const Icon = c.icon;
            return (
              <Card key={i} data-testid={`card-stat-${i}`}>
                <CardContent className="p-4 text-center">
                  <Icon className="w-8 h-8 mx-auto mb-2" style={{ color: c.color }} />
                  <div className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{c.label}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {alerts && alerts.length > 0 && (
          <Card className="border-amber-200 bg-amber-50" data-testid="card-calibration-alerts">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <span className="font-bold text-amber-800">แจ้งเตือนสอบเทียบเครื่องมือวัด</span>
                <Badge variant="destructive">{alerts.length} รายการ</Badge>
              </div>
              <div className="space-y-2">
                {alerts.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between bg-white rounded p-2 border border-amber-200">
                    <div>
                      <span className="font-medium">{a.code}</span> — {a.name}
                    </div>
                    <Badge variant="outline" className="text-amber-700 border-amber-400">
                      ครบกำหนด {a.nextDueDate}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {!companyId && (
          <div className="text-center text-gray-400 py-12" data-testid="text-no-company">กรุณาเลือกบริษัทก่อน</div>
        )}
      </div>
    </ManufacturingLayout>
  );
}
