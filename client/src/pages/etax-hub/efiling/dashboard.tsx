import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import EtaxCenterLayout from "@/components/etax-center-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Send, FileText, Receipt, Settings, AlertTriangle, CheckCircle2, Clock,
  XCircle, Search, Calendar, Building2, ArrowRight, Filter, Download, RefreshCw,
} from "lucide-react";

type FilingStatus = "ready" | "missing-data" | "no-consent" | "submitted" | "paid" | "receipt-issued" | "rejected" | "overdue";
type FormType = "PP30" | "PP36" | "PND1" | "PND2" | "PND54";

interface ClientFiling {
  id: string;
  clientName: string;
  taxId: string;
  formType: FormType;
  period: string;
  dueDate: string;
  status: FilingStatus;
  amount: number;
  rdRefNo?: string;
}

const MOCK_CLIENTS: ClientFiling[] = [
  { id: "1", clientName: "บริษัท เอบีซี จำกัด", taxId: "0105561012345", formType: "PP30", period: "2026-03", dueDate: "2026-04-23", status: "ready", amount: 28450 },
  { id: "2", clientName: "บริษัท สยามทรัพย์ จำกัด", taxId: "0105560054321", formType: "PP30", period: "2026-03", dueDate: "2026-04-23", status: "missing-data", amount: 0 },
  { id: "3", clientName: "ห้างหุ้นส่วน วัฒนา", taxId: "0103562098765", formType: "PP30", period: "2026-03", dueDate: "2026-04-23", status: "no-consent", amount: 12300 },
  { id: "4", clientName: "บริษัท เทคโนโลยีไทย จำกัด", taxId: "0105563087654", formType: "PP30", period: "2026-02", dueDate: "2026-03-23", status: "receipt-issued", amount: 156780, rdRefNo: "0226030001234" },
  { id: "5", clientName: "บริษัท สมาร์ทเซอร์วิส จำกัด", taxId: "0105564076543", formType: "PP36", period: "2026-03", dueDate: "2026-04-23", status: "ready", amount: 8400 },
  { id: "6", clientName: "บริษัท เกษตรไทย จำกัด", taxId: "0105565065432", formType: "PND1", period: "2026-03", dueDate: "2026-04-07", status: "overdue", amount: 45200 },
  { id: "7", clientName: "บริษัท โลจิสติกส์โปร จำกัด", taxId: "0105566054321", formType: "PP30", period: "2026-03", dueDate: "2026-04-23", status: "submitted", amount: 89100, rdRefNo: "0126030005678" },
  { id: "8", clientName: "บริษัท ครีเอทีฟดีไซน์ จำกัด", taxId: "0105567043210", formType: "PP30", period: "2026-03", dueDate: "2026-04-23", status: "paid", amount: 34500, rdRefNo: "0126030009012" },
  { id: "9", clientName: "บริษัท ฟู้ดเดลิเวอรี่ จำกัด", taxId: "0105568032109", formType: "PP30", period: "2026-03", dueDate: "2026-04-23", status: "rejected", amount: 0 },
  { id: "10", clientName: "บริษัท บิวตี้แอนด์เฮลท์ จำกัด", taxId: "0105569021098", formType: "PP30", period: "2026-03", dueDate: "2026-04-23", status: "ready", amount: 67800 },
  { id: "11", clientName: "บริษัท ไอทีโซลูชั่น จำกัด", taxId: "0105570010987", formType: "PP30", period: "2026-03", dueDate: "2026-04-23", status: "ready", amount: 23100 },
  { id: "12", clientName: "บริษัท คอนสตรัคชั่น จำกัด", taxId: "0105571009876", formType: "PND1", period: "2026-03", dueDate: "2026-04-07", status: "ready", amount: 78400 },
];

const STATUS_CONFIG: Record<FilingStatus, { label: string; color: string; icon: any }> = {
  "ready": { label: "พร้อมยื่น", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  "missing-data": { label: "ขาดข้อมูล", color: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertTriangle },
  "no-consent": { label: "รอลูกค้าเซ็น consent", color: "bg-orange-100 text-orange-700 border-orange-200", icon: AlertTriangle },
  "submitted": { label: "ส่งแล้ว รอชำระ", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Clock },
  "paid": { label: "ชำระแล้ว รอใบเสร็จ", color: "bg-violet-100 text-violet-700 border-violet-200", icon: Clock },
  "receipt-issued": { label: "ใบเสร็จออกแล้ว", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
  "rejected": { label: "RD ปฏิเสธ", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
  "overdue": { label: "เลยกำหนด", color: "bg-red-100 text-red-700 border-red-200", icon: AlertTriangle },
};

const FORM_LABELS: Record<FormType, string> = {
  PP30: "ภ.พ.30 (VAT)",
  PP36: "ภ.พ.36 (VAT ต่างประเทศ)",
  PND1: "ภ.ง.ด.1 (เงินเดือน)",
  PND2: "ภ.ง.ด.2 (ดอกเบี้ย/ปันผล)",
  PND54: "ภ.ง.ด.54 (จ่ายต่างประเทศ)",
};

export default function EfilingDashboard() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState("2026-03");
  const [formFilter, setFormFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return MOCK_CLIENTS.filter(c => {
      if (search && !c.clientName.includes(search) && !c.taxId.includes(search)) return false;
      if (periodFilter !== "all" && c.period !== periodFilter) return false;
      if (formFilter !== "all" && c.formType !== formFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      return true;
    });
  }, [search, periodFilter, formFilter, statusFilter]);

  const stats = useMemo(() => {
    const periodData = MOCK_CLIENTS.filter(c => c.period === periodFilter);
    return {
      total: periodData.length,
      ready: periodData.filter(c => c.status === "ready").length,
      blocked: periodData.filter(c => ["missing-data", "no-consent"].includes(c.status)).length,
      submitted: periodData.filter(c => ["submitted", "paid", "receipt-issued"].includes(c.status)).length,
      issues: periodData.filter(c => ["rejected", "overdue"].includes(c.status)).length,
      totalTax: periodData.filter(c => c.status === "ready").reduce((s, c) => s + c.amount, 0),
    };
  }, [periodFilter]);

  const readySelected = filtered.filter(c => c.status === "ready");

  return (
    <EtaxCenterLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <span>e-Filing</span>
              <ArrowRight className="w-3 h-3" />
              <span>ยื่นแบบผ่าน RD Open API</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="text-efiling-dashboard-title">
              ศูนย์ยื่นแบบอิเล็กทรอนิกส์
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              ยื่นแบบและจ่ายภาษีให้ลูกค้าทั้ง 447 บริษัท ผ่าน RD Open API ในคลิกเดียว
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" data-testid="btn-efiling-settings" onClick={() => setLocation("/etax-hub/efiling/settings")}>
              <Settings className="w-4 h-4 mr-2" />ตั้งค่า
            </Button>
            <Button variant="outline" data-testid="btn-efiling-receipts" onClick={() => setLocation("/etax-hub/efiling/receipts")}>
              <Receipt className="w-4 h-4 mr-2" />ใบเสร็จ + บันทึกบัญชี
            </Button>
            <Button
              className="bg-[#fb9678] hover:bg-[#e8856a] text-white"
              data-testid="btn-bulk-submit"
              disabled={readySelected.length === 0}
              onClick={() => setLocation(`/etax-hub/efiling/submit?period=${periodFilter}&form=${formFilter}`)}
            >
              <Send className="w-4 h-4 mr-2" />
              ยื่นแบบ ({readySelected.length} รายการ)
            </Button>
          </div>
        </div>

        {/* Cert + RD Connection Status Bar */}
        <Card className="border-0 shadow-sm" data-testid="card-rd-status">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-sm">
                    <span className="text-gray-500">OA1- Credential:</span>{" "}
                    <span className="font-medium text-amber-600">รอ RD ออกให้ (ภ.อ.01.2 — ส่งแล้ว I021000001668)</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-sm">
                    <span className="text-gray-500">CA Certificate:</span>{" "}
                    <span className="font-medium text-amber-600">รอติดตั้ง</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-sm">
                    <span className="text-gray-500">ETDA Certification:</span>{" "}
                    <span className="font-medium text-amber-600">กำลังดำเนินการ</span>
                  </span>
                </div>
              </div>
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                โหมดทดสอบ (Sandbox / Mock data)
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="ทั้งหมด" value={stats.total} icon={Building2} color="#03c9d7" testId="kpi-total" />
          <KpiCard label="พร้อมยื่น" value={stats.ready} icon={CheckCircle2} color="#05b187" testId="kpi-ready" />
          <KpiCard label="ติดปัญหา" value={stats.blocked} icon={AlertTriangle} color="#fec90f" testId="kpi-blocked" />
          <KpiCard label="ส่งแล้ว" value={stats.submitted} icon={Send} color="#3b82f6" testId="kpi-submitted" />
          <KpiCard label="ปัญหา/เลยกำหนด" value={stats.issues} icon={XCircle} color="#ef4444" testId="kpi-issues" />
          <KpiCard
            label="ยอดภาษีที่ยื่น"
            value={`฿${stats.totalTax.toLocaleString()}`}
            icon={FileText}
            color="#8b5cf6"
            testId="kpi-tax-total"
            isLarge
          />
        </div>

        {/* Filters + Table */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-base">รายการยื่นแบบ</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="ค้นหาชื่อบริษัท / เลขผู้เสียภาษี"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9 w-64"
                    data-testid="input-search-clients"
                  />
                </div>
                <Select value={periodFilter} onValueChange={setPeriodFilter}>
                  <SelectTrigger className="w-36" data-testid="select-period">
                    <Calendar className="w-4 h-4 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2026-03">มี.ค. 2569</SelectItem>
                    <SelectItem value="2026-02">ก.พ. 2569</SelectItem>
                    <SelectItem value="2026-01">ม.ค. 2569</SelectItem>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={formFilter} onValueChange={setFormFilter}>
                  <SelectTrigger className="w-44" data-testid="select-form">
                    <FileText className="w-4 h-4 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกแบบ</SelectItem>
                    <SelectItem value="PP30">ภ.พ.30</SelectItem>
                    <SelectItem value="PP36">ภ.พ.36</SelectItem>
                    <SelectItem value="PND1">ภ.ง.ด.1</SelectItem>
                    <SelectItem value="PND2">ภ.ง.ด.2</SelectItem>
                    <SelectItem value="PND54">ภ.ง.ด.54</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-44" data-testid="select-status">
                    <Filter className="w-4 h-4 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกสถานะ</SelectItem>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-y border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">บริษัท</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">เลขผู้เสียภาษี</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">แบบ</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">งวด</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">กำหนดยื่น</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">ภาษี (บาท)</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">สถานะ</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">RD Ref No.</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">การกระทำ</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((client) => {
                    const status = STATUS_CONFIG[client.status];
                    const StatusIcon = status.icon;
                    return (
                      <tr key={client.id} className="border-b border-gray-100 hover:bg-gray-50" data-testid={`row-client-${client.id}`}>
                        <td className="px-4 py-3 font-medium" data-testid={`text-client-name-${client.id}`}>{client.clientName}</td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">{client.taxId}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="font-normal text-xs">{FORM_LABELS[client.formType]}</Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{client.period}</td>
                        <td className="px-4 py-3 text-gray-600">{client.dueDate}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">
                          {client.amount > 0 ? client.amount.toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`${status.color} gap-1 font-normal`} data-testid={`badge-status-${client.id}`}>
                            <StatusIcon className="w-3 h-3" />{status.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{client.rdRefNo || "—"}</td>
                        <td className="px-4 py-3 text-right">
                          {client.status === "ready" && (
                            <Button size="sm" variant="ghost" data-testid={`btn-submit-${client.id}`}
                              onClick={() => setLocation(`/etax-hub/efiling/submit?clientId=${client.id}`)}>
                              ยื่น <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                          )}
                          {["receipt-issued", "paid"].includes(client.status) && (
                            <Button size="sm" variant="ghost" data-testid={`btn-receipt-${client.id}`}
                              onClick={() => setLocation(`/etax-hub/efiling/receipts?clientId=${client.id}`)}>
                              ใบเสร็จ <Receipt className="w-3 h-3 ml-1" />
                            </Button>
                          )}
                          {client.status === "no-consent" && (
                            <Button size="sm" variant="ghost" className="text-orange-600" data-testid={`btn-consent-${client.id}`}>
                              ส่ง consent
                            </Button>
                          )}
                          {client.status === "rejected" && (
                            <Button size="sm" variant="ghost" className="text-red-600" data-testid={`btn-error-${client.id}`}>
                              ดู error
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="text-center py-12 text-gray-400">ไม่พบรายการ</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </EtaxCenterLayout>
  );
}

function KpiCard({ label, value, icon: Icon, color, testId, isLarge }: {
  label: string; value: any; icon: any; color: string; testId: string; isLarge?: boolean;
}) {
  return (
    <Card className="border-0 shadow-sm" data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs text-gray-500 truncate">{label}</p>
            <p className={`font-bold mt-1 truncate ${isLarge ? "text-lg" : "text-2xl"}`} style={{ color }}>{value}</p>
          </div>
          <div className="rounded-lg p-2 shrink-0" style={{ backgroundColor: `${color}15` }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
