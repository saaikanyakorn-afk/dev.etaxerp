import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Radio,
  DollarSign,
  TrendingUp,
  Plus,
  Calendar,
  ChevronRight,
  Home,
  Loader2,
} from "lucide-react";

const PLATFORMS = [
  { value: "facebook", label: "Facebook", className: "bg-[#e5f9fa] text-[#03c9d7] hover:bg-[#e5f9fa]" },
  { value: "tiktok", label: "TikTok", className: "bg-pink-100 text-pink-700 hover:bg-pink-100" },
  { value: "instagram", label: "Instagram", className: "bg-purple-100 text-purple-700 hover:bg-purple-100" },
  { value: "shopee", label: "Shopee", className: "bg-orange-100 text-orange-700 hover:bg-orange-100" },
  { value: "lazada", label: "Lazada", className: "bg-blue-100 text-blue-700 hover:bg-blue-100" },
  { value: "line", label: "LINE", className: "bg-green-100 text-green-700 hover:bg-green-100" },
];

const SESSION_STATUSES: Record<string, { label: string; className: string }> = {
  scheduled: { label: "นัดหมายแล้ว", className: "bg-blue-100 text-blue-700 hover:bg-blue-100" },
  live: { label: "🔴 กำลังไลฟ์", className: "bg-red-100 text-red-600 hover:bg-red-100 animate-pulse" },
  ended: { label: "จบแล้ว", className: "bg-green-100 text-green-700 hover:bg-green-100" },
  draft: { label: "แบบร่าง", className: "bg-gray-100 text-gray-700 hover:bg-gray-100" },
  cancelled: { label: "ยกเลิก", className: "bg-red-100 text-red-700 hover:bg-red-100" },
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function formatCurrency(v: string | number | null | undefined): string {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function platformBadge(platform: string) {
  const p = PLATFORMS.find(pl => pl.value === platform);
  if (!p) return <Badge data-testid={`badge-platform-${platform}`} className="bg-gray-100 text-gray-700 hover:bg-gray-100">{platform}</Badge>;
  return <Badge data-testid={`badge-platform-${platform}`} className={p.className}>{p.label}</Badge>;
}

function statusBadge(status: string) {
  const s = SESSION_STATUSES[status];
  if (!s) return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">{status}</Badge>;
  return <Badge data-testid={`badge-status-${status}`} className={s.className}>{s.label}</Badge>;
}

type ClientForm = {
  clientName: string;
  contactPerson: string;
  phone: string;
  email: string;
  platforms: string[];
  feeModel: string;
  feeRate: string;
};

const emptyClientForm: ClientForm = {
  clientName: "",
  contactPerson: "",
  phone: "",
  email: "",
  platforms: [],
  feeModel: "",
  feeRate: "",
};

export default function AgencyDashboard() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [clientForm, setClientForm] = useState<ClientForm>({ ...emptyClientForm });

  const { data: clients = [], isLoading: clientsLoading } = useQuery<any[]>({
    queryKey: ["/api/live-agency/clients", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      const res = await apiRequest("GET", `/api/live-agency/clients?companyId=${selectedCompanyId}`);
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: calendarSessions = [], isLoading: calendarLoading } = useQuery<any[]>({
    queryKey: ["/api/live-agency/calendar", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      const res = await apiRequest("GET", `/api/live-agency/calendar?companyId=${selectedCompanyId}`);
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<any[]>({
    queryKey: ["/api/live-agency/sessions", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      const res = await apiRequest("GET", `/api/live-agency/sessions?companyId=${selectedCompanyId}`);
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });

  const createClient = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/live-agency/clients", {
        ...data,
        companyId: selectedCompanyId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/live-agency/clients"] });
      toast({ title: "เพิ่มลูกค้าสำเร็จ" });
      resetClientForm();
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  function resetClientForm() {
    setClientForm({ ...emptyClientForm });
    setClientDialogOpen(false);
  }

  function handleSubmitClient() {
    if (!clientForm.clientName || !clientForm.feeModel) {
      toast({ title: "กรุณากรอกชื่อลูกค้าและรูปแบบค่าบริการ", variant: "destructive" });
      return;
    }
    createClient.mutate({
      clientName: clientForm.clientName,
      contactPerson: clientForm.contactPerson,
      phone: clientForm.phone,
      email: clientForm.email,
      platforms: clientForm.platforms,
      feeModel: clientForm.feeModel,
      feeRate: clientForm.feeRate ? Number(clientForm.feeRate) : 0,
    });
  }

  function togglePlatform(platform: string) {
    setClientForm(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...prev.platforms, platform],
    }));
  }

  const totalClients = clients.length;
  const livesThisMonth = sessions.filter((s: any) => {
    if (!s.scheduledAt && !s.startTime) return false;
    const d = new Date(s.scheduledAt || s.startTime);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const totalRevenue = sessions.reduce((sum: number, s: any) => sum + Number(s.revenue || 0), 0);
  const avgRoas = sessions.length > 0
    ? sessions.reduce((sum: number, s: any) => sum + Number(s.roas || 0), 0) / sessions.length
    : 0;

  const kpiCards = [
    {
      title: "ลูกค้าทั้งหมด",
      value: totalClients.toLocaleString(),
      icon: Users,
      color: "#03c9d7",
      bgColor: "#e5f9fa",
      testId: "kpi-total-clients",
    },
    {
      title: "ไลฟ์เดือนนี้",
      value: livesThisMonth.toLocaleString(),
      icon: Radio,
      color: "#fb9678",
      bgColor: "#fff3ef",
      testId: "kpi-lives-this-month",
    },
    {
      title: "ยอดขายรวม",
      value: `฿${formatCurrency(totalRevenue)}`,
      icon: DollarSign,
      color: "#05b187",
      bgColor: "#e6f7f2",
      testId: "kpi-total-revenue",
    },
    {
      title: "ROAS เฉลี่ย",
      value: avgRoas.toFixed(2) + "x",
      icon: TrendingUp,
      color: "var(--theme-primary)",
      bgColor: "#eef4ff",
      testId: "kpi-avg-roas",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-1" data-testid="breadcrumb">
            <Home className="h-3.5 w-3.5" />
            <span>หน้าหลัก</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-gray-800 font-medium">AI Live Agency</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#fb9678" }} data-testid="text-page-title">
            AI Live Agency
          </h1>
        </div>
        <Button
          onClick={() => setClientDialogOpen(true)}
          className="text-white"
          style={{ background: "#fb9678" }}
          data-testid="button-add-client"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          เพิ่มลูกค้า
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.testId} className="shadow-sm" data-testid={kpi.testId}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">{kpi.title}</p>
                  <p className="text-2xl font-bold" data-testid={`${kpi.testId}-value`}>{kpi.value}</p>
                </div>
                <div
                  className="h-12 w-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: kpi.bgColor }}
                >
                  <kpi.icon className="h-6 w-6" style={{ color: kpi.color }} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" style={{ color: "#fb9678" }} />
              ไลฟ์ที่กำลังจะมาถึง
            </CardTitle>
          </CardHeader>
          <CardContent>
            {calendarLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : calendarSessions.length === 0 ? (
              <div className="text-center py-8 text-gray-400" data-testid="text-no-upcoming">
                ยังไม่มีไลฟ์ที่กำลังจะมาถึง
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>วัน/เวลา</TableHead>
                      <TableHead>ลูกค้า</TableHead>
                      <TableHead>แพลตฟอร์ม</TableHead>
                      <TableHead className="text-right">เป้ายอดขาย</TableHead>
                      <TableHead>สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calendarSessions.map((session: any, idx: number) => (
                      <TableRow key={session.id || idx} data-testid={`row-upcoming-${session.id || idx}`}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDateTime(session.scheduledAt || session.startTime)}
                        </TableCell>
                        <TableCell className="font-medium text-sm">{session.clientName || "-"}</TableCell>
                        <TableCell>{platformBadge(session.platform)}</TableCell>
                        <TableCell className="text-right text-sm">
                          {session.targetRevenue ? `฿${formatCurrency(session.targetRevenue)}` : "-"}
                        </TableCell>
                        <TableCell>{statusBadge(session.status || "scheduled")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" style={{ color: "#03c9d7" }} />
              ลูกค้า Agency
            </CardTitle>
          </CardHeader>
          <CardContent>
            {clientsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : clients.length === 0 ? (
              <div className="text-center py-8 text-gray-400" data-testid="text-no-clients">
                ยังไม่มีลูกค้า
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {clients.map((client: any, idx: number) => (
                  <div
                    key={client.id || idx}
                    className="p-3 rounded-lg border bg-white hover:shadow-sm transition-shadow"
                    data-testid={`card-client-${client.id || idx}`}
                  >
                    <p className="font-medium text-sm mb-1.5">{client.clientName || client.name}</p>
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {(Array.isArray(client.platforms) ? client.platforms : []).map((p: string) => (
                        <span key={p}>{platformBadge(p)}</span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">
                      {client.feeModel === "percent"
                        ? `ค่าบริการ ${client.feeRate || 0}%`
                        : client.feeModel === "fixed"
                        ? `ค่าบริการคงที่ ฿${Number(client.feeRate || 0).toLocaleString()}`
                        : client.feeModel || "-"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Radio className="h-5 w-5" style={{ color: "#fb9678" }} />
            ไลฟ์ล่าสุด
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-400" data-testid="text-no-sessions">
              ยังไม่มีข้อมูลไลฟ์
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อเซสชัน</TableHead>
                    <TableHead>แพลตฟอร์ม</TableHead>
                    <TableHead>วันที่</TableHead>
                    <TableHead className="text-right">ออเดอร์</TableHead>
                    <TableHead className="text-right">ยอดขาย</TableHead>
                    <TableHead className="text-right">ROAS</TableHead>
                    <TableHead>สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session: any, idx: number) => (
                    <TableRow key={session.id || idx} data-testid={`row-session-${session.id || idx}`}>
                      <TableCell className="font-medium text-sm">{session.title || "-"}</TableCell>
                      <TableCell>{platformBadge(session.platform)}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDate(session.scheduledAt || session.startTime || session.createdAt)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {Number(session.orders || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        ฿{formatCurrency(session.revenue)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {Number(session.roas || 0).toFixed(2)}x
                      </TableCell>
                      <TableCell>{statusBadge(session.status || "draft")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={clientDialogOpen} onOpenChange={setClientDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>เพิ่มลูกค้า Agency</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ชื่อลูกค้า / บริษัท *</Label>
              <Input
                value={clientForm.clientName}
                onChange={e => setClientForm(prev => ({ ...prev, clientName: e.target.value }))}
                placeholder="ชื่อลูกค้าหรือบริษัท"
                data-testid="input-client-name"
              />
            </div>
            <div>
              <Label>ผู้ติดต่อ</Label>
              <Input
                value={clientForm.contactPerson}
                onChange={e => setClientForm(prev => ({ ...prev, contactPerson: e.target.value }))}
                placeholder="ชื่อผู้ติดต่อ"
                data-testid="input-contact-person"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>โทรศัพท์</Label>
                <Input
                  value={clientForm.phone}
                  onChange={e => setClientForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="0xx-xxx-xxxx"
                  data-testid="input-phone"
                />
              </div>
              <div>
                <Label>อีเมล</Label>
                <Input
                  type="email"
                  value={clientForm.email}
                  onChange={e => setClientForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@example.com"
                  data-testid="input-email"
                />
              </div>
            </div>
            <div>
              <Label>แพลตฟอร์ม</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {PLATFORMS.map(p => (
                  <Badge
                    key={p.value}
                    className={`cursor-pointer transition-all ${
                      clientForm.platforms.includes(p.value)
                        ? p.className + " ring-2 ring-offset-1 ring-[#fb9678]"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                    onClick={() => togglePlatform(p.value)}
                    data-testid={`toggle-platform-${p.value}`}
                  >
                    {p.label}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>รูปแบบค่าบริการ *</Label>
                <Select
                  value={clientForm.feeModel}
                  onValueChange={v => setClientForm(prev => ({ ...prev, feeModel: v }))}
                >
                  <SelectTrigger data-testid="select-fee-model">
                    <SelectValue placeholder="เลือกรูปแบบ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">เปอร์เซ็นต์ (%)</SelectItem>
                    <SelectItem value="fixed">คงที่ (บาท)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>อัตราค่าบริการ</Label>
                <Input
                  type="number"
                  value={clientForm.feeRate}
                  onChange={e => setClientForm(prev => ({ ...prev, feeRate: e.target.value }))}
                  placeholder={clientForm.feeModel === "percent" ? "เช่น 15" : "เช่น 5000"}
                  data-testid="input-fee-rate"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={resetClientForm}
                data-testid="button-cancel-client"
              >
                ยกเลิก
              </Button>
              <Button
                onClick={handleSubmitClient}
                disabled={createClient.isPending}
                className="text-white"
                style={{ background: "#fb9678" }}
                data-testid="button-submit-client"
              >
                {createClient.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                บันทึก
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
