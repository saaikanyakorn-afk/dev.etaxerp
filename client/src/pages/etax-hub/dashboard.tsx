import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import EtaxCenterLayout from "@/components/etax-center-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company-context";
import {
  Kanban,
  Users,
  UserCheck,
  UserPlus,
  Plus,
  ArrowRight,
  BarChart3,
} from "lucide-react";

export default function EtaxHubDashboard() {
  const { user } = useAuth();
  const { selectedCompanyId, primaryCompanyId } = useCompany();
  const [, setLocation] = useLocation();
  const firmCompanyId = primaryCompanyId || selectedCompanyId;

  const { data: boardsRaw = [] } = useQuery<any[]>({
    queryKey: ["/api/etax-hub/boards", firmCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/etax-hub/boards?companyId=${firmCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d) ? d : [];
    },
    enabled: !!firmCompanyId,
  });
  const boards = Array.isArray(boardsRaw) ? boardsRaw : [];

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/etax-hub/stats", firmCompanyId],
    queryFn: () => fetch(`/api/etax-hub/stats?companyId=${firmCompanyId}`, { credentials: "include" }).then(r => r.json()).catch(() => ({})),
    enabled: !!firmCompanyId,
  });

  const totalUsers = stats?.totalUsers ?? 0;
  const employeeCount = stats?.employeeCount ?? 0;
  const guestCount = stats?.guestCount ?? 0;
  const totalBoards = stats?.totalBoards ?? boards.length;

  const kpiCards = [
    { label: "ผู้ใช้งานทั้งหมด", value: totalUsers, icon: Users, color: "#03c9d7", bg: "bg-[#03c9d7]/10" },
    { label: "พนักงาน", value: employeeCount, icon: UserCheck, color: "#05b187", bg: "bg-[#05b187]/10" },
    { label: "Guest", value: guestCount, icon: UserPlus, color: "#fec90f", bg: "bg-[#fec90f]/10" },
    { label: "บอร์ดทั้งหมด", value: totalBoards, icon: Kanban, color: "#fb9678", bg: "bg-[#fb9678]/10" },
  ];

  return (
    <EtaxCenterLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="text-etax-hub-title">E-Tax Hub</h1>
            <p className="text-gray-500 text-sm mt-1">จัดการงานลูกค้าและมอบหมายงานสไตล์ Monday.com</p>
          </div>
          <Button
            className="bg-[#fb9678] hover:bg-[#e8856a] text-white"
            onClick={() => setLocation("/etax-hub/board")}
            data-testid="btn-go-client-board"
          >
            <Plus className="w-4 h-4 mr-2" />
            เปิด Client Board
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((kpi, i) => (
            <Card key={i} className="border-0 shadow-sm" data-testid={`kpi-card-${i}`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{kpi.label}</p>
                    <p className="text-3xl font-bold mt-1" style={{ color: kpi.color }}>{kpi.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                    <kpi.icon className="w-6 h-6" style={{ color: kpi.color }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Kanban className="w-5 h-5 text-[#fb9678]" />
                  บอร์ดล่าสุด
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[#fb9678] hover:text-[#e8856a]"
                  onClick={() => setLocation("/etax-hub/board")}
                  data-testid="btn-view-all-boards"
                >
                  ดูทั้งหมด
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              {boards.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Kanban className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">ยังไม่มีบอร์ด</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 border-[#fb9678] text-[#fb9678]"
                    onClick={() => setLocation("/etax-hub/board")}
                    data-testid="btn-create-first-board"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    สร้างบอร์ดแรก
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {boards.slice(0, 6).map((b: any) => (
                    <div
                      key={b.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setLocation("/etax-hub/board")}
                      data-testid={`board-item-${b.id}`}
                    >
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: b.color || "#539BFF" }} />
                      <span className="font-medium text-sm text-gray-700 flex-1">{b.name}</span>
                      <Badge variant="secondary" className="text-xs">{b.itemCount ?? 0} รายการ</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-[#03c9d7]" />
                Quick Actions
              </h3>
              <div className="grid grid-cols-1 gap-3">
                <Button
                  variant="outline"
                  className="justify-start h-auto py-4 px-4 border-gray-200 hover:border-[#fb9678] hover:bg-[#fb9678]/5"
                  onClick={() => setLocation("/etax-hub/board")}
                  data-testid="btn-quick-new-board"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#fb9678]/10 flex items-center justify-center mr-3">
                    <Plus className="w-5 h-5 text-[#fb9678]" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-800">สร้างบอร์ดใหม่</p>
                    <p className="text-xs text-gray-400 mt-0.5">เช่น ปิดงบ 68 ส่ง CPA-xxx</p>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="justify-start h-auto py-4 px-4 border-gray-200 hover:border-[#03c9d7] hover:bg-[#03c9d7]/5"
                  onClick={() => setLocation("/etax-hub/board")}
                  data-testid="btn-quick-add-client"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#03c9d7]/10 flex items-center justify-center mr-3">
                    <Users className="w-5 h-5 text-[#03c9d7]" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-800">เพิ่มลูกค้า</p>
                    <p className="text-xs text-gray-400 mt-0.5">เพิ่มรายชื่อลูกค้าในบอร์ด</p>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="justify-start h-auto py-4 px-4 border-gray-200 hover:border-[#05b187] hover:bg-[#05b187]/5"
                  onClick={() => setLocation("/firm-mgmt/clients")}
                  data-testid="btn-quick-firm-clients"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#05b187]/10 flex items-center justify-center mr-3">
                    <UserCheck className="w-5 h-5 text-[#05b187]" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-800">รายชื่อลูกค้าสำนักงาน</p>
                    <p className="text-xs text-gray-400 mt-0.5">ดูรายชื่อลูกค้าทั้งหมดจากระบบ</p>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </EtaxCenterLayout>
  );
}
