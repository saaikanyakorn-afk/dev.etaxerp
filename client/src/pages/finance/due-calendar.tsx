import { useState, useMemo } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, ChevronLeft, ChevronRight, Loader2, AlertTriangle, CheckCircle, Clock, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useCompany } from "@/lib/company-context";
import { formatDate } from "@/lib/format";

import { useDateSettings } from "@/hooks/use-date-settings";
const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const DAY_NAMES = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function fmt(val: number): string {
  return val.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface DueItem {
  id: number;
  docNo: string;
  docDate: string;
  dueDate: string;
  contactName: string;
  totalAmount: number;
  paymentStatus: string;
  status: string;
  type: "AR" | "AP";
  docType: string;
}

function docTypeLabel(dt: string) {
  switch (dt) {
    case "IV": return "ใบแจ้งหนี้";
    case "TIV": return "ใบกำกับภาษี";
    case "AP": return "เอกสารซื้อ";
    case "EXP": return "รายจ่าย";
    default: return dt;
  }
}

function docRoute(docType: string, id: number): string | null {
  switch (docType) {
    case "IV": return `/sales/invoice`;
    case "TIV": return `/sales/tax-invoice`;
    case "AP": return `/purchases/invoice`;
    case "EXP": return `/purchases/expense`;
    default: return null;
  }
}

function paymentStatusBadge(ps: string) {
  switch (ps) {
    case "paid":
    case "success":
      return <Badge className="text-[9px] bg-green-100 text-green-700 border-0"><CheckCircle className="h-2.5 w-2.5 mr-0.5" /> ชำระแล้ว</Badge>;
    case "partial":
    case "partially_paid":
      return <Badge className="text-[9px] bg-amber-100 text-amber-700 border-0"><Clock className="h-2.5 w-2.5 mr-0.5" /> ชำระบางส่วน</Badge>;
    case "overpaid":
      return <Badge className="text-[9px] bg-purple-100 text-purple-700 border-0"><CheckCircle className="h-2.5 w-2.5 mr-0.5" /> ชำระเกิน</Badge>;
    default:
      return <Badge className="text-[9px] bg-red-100 text-red-700 border-0"><AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> ยังไม่ชำระ</Badge>;
  }
}

export default function DueCalendar() {
  const [, navigate] = useLocation();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "AR" | "AP">("all");

  const { dateEra, dateFmt } = useDateSettings();
  const { data: docSettings } = useQuery<any>({
    queryKey: ["/api/document-settings", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const res = await fetch(`/api/document-settings?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
  });
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/finance/due-calendar", companyId, month, year],
    queryFn: async () => {
      if (!companyId) return null;
      const params = new URLSearchParams({ companyId: String(companyId), month: String(month), year: String(year) });
      const res = await fetch(`/api/finance/due-calendar?${params}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
  });

  const items: DueItem[] = data?.items || [];

  const filteredItems = filter === "all" ? items : items.filter(i => i.type === filter);

  const itemsByDate = useMemo(() => {
    const map: Record<string, DueItem[]> = {};
    for (const item of filteredItems) {
      if (!item.dueDate) continue;
      if (!map[item.dueDate]) map[item.dueDate] = [];
      map[item.dueDate].push(item);
    }
    return map;
  }, [filteredItems]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [year, month]);

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  function dateStr(day: number) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
  }

  const displayYear = dateEra === "BE" ? year + 543 : year;

  const selectedItems = selectedDate ? (itemsByDate[selectedDate] || []) : [];

  const totalAR = filteredItems.filter(i => i.type === "AR").reduce((s, i) => s + i.totalAmount, 0);
  const totalAP = filteredItems.filter(i => i.type === "AP").reduce((s, i) => s + i.totalAmount, 0);
  const unpaidAR = filteredItems.filter(i => i.type === "AR" && i.paymentStatus !== "paid").reduce((s, i) => s + i.totalAmount, 0);
  const unpaidAP = filteredItems.filter(i => i.type === "AP" && i.paymentStatus !== "paid").reduce((s, i) => s + i.totalAmount, 0);

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-[#03c9d7]" />
          <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">ปฏิทินครบกำหนดชำระ</h1>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-0 shadow-sm" data-testid="card-summary-ar">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">ลูกหนี้ครบกำหนด (AR)</div>
              <div className="text-lg font-bold text-[var(--theme-primary)]">{fmt(totalAR)}</div>
              <div className="text-[10px] text-red-500">ค้างชำระ: {fmt(unpaidAR)}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm" data-testid="card-summary-ap">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">เจ้าหนี้ครบกำหนด (AP)</div>
              <div className="text-lg font-bold text-[#fb9678]">{fmt(totalAP)}</div>
              <div className="text-[10px] text-red-500">ค้างชำระ: {fmt(unpaidAP)}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm" data-testid="card-summary-docs">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">จำนวนเอกสาร</div>
              <div className="text-lg font-bold text-gray-700">{filteredItems.length} รายการ</div>
              <div className="text-[10px] text-muted-foreground">ในเดือนนี้</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm" data-testid="card-summary-overdue">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">เกินกำหนด</div>
              <div className="text-lg font-bold text-red-500">
                {filteredItems.filter(i => i.dueDate < todayStr && i.paymentStatus !== "paid" && i.paymentStatus !== "success" && i.paymentStatus !== "overpaid").length} รายการ
              </div>
              <div className="text-[10px] text-red-400">ยังไม่ชำระ</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-40 h-9" data-testid="select-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value="AR">ลูกหนี้ (AR)</SelectItem>
              <SelectItem value="AP">เจ้าหนี้ (AP)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8">
            <Card className="border-0 shadow-md" data-testid="card-calendar">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={prevMonth} data-testid="button-prev-month">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <CardTitle className="text-base font-bold">{THAI_MONTHS[month - 1]} {displayYear}</CardTitle>
                  <Button variant="ghost" size="sm" onClick={nextMonth} data-testid="button-next-month">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-2">
                {isLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-7 mb-1">
                      {DAY_NAMES.map(d => (
                        <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-[2px]">
                      {calendarDays.map((day, idx) => {
                        if (day === null) return <div key={`empty-${idx}`} className="h-20" />;
                        const ds = dateStr(day);
                        const dayItems = itemsByDate[ds] || [];
                        const isToday = ds === todayStr;
                        const isSelected = ds === selectedDate;
                        const arCount = dayItems.filter(i => i.type === "AR").length;
                        const apCount = dayItems.filter(i => i.type === "AP").length;
                        const hasOverdue = dayItems.some(i => i.paymentStatus !== "paid" && i.paymentStatus !== "success" && i.paymentStatus !== "overpaid") && ds < todayStr;

                        return (
                          <div
                            key={day}
                            className={`h-20 p-1 border rounded-lg cursor-pointer transition-all text-xs ${
                              isSelected ? "border-[#03c9d7] bg-[#03c9d710] ring-1 ring-[#03c9d7]" :
                              isToday ? "border-[#fb9678] bg-[#fb967810]" :
                              dayItems.length > 0 ? "border-gray-200 bg-white hover:border-gray-300" :
                              "border-transparent hover:bg-gray-50"
                            }`}
                            onClick={() => setSelectedDate(ds)}
                            data-testid={`cell-day-${day}`}
                          >
                            <div className={`text-right text-[11px] font-medium ${isToday ? "text-[#fb9678] font-bold" : "text-gray-600"}`}>
                              {day}
                            </div>
                            {dayItems.length > 0 && (
                              <div className="mt-0.5 space-y-0.5">
                                {arCount > 0 && (
                                  <div className="flex items-center gap-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-primary)] shrink-0" />
                                    <span className="text-[9px] text-[var(--theme-primary)] truncate">AR {arCount}</span>
                                  </div>
                                )}
                                {apCount > 0 && (
                                  <div className="flex items-center gap-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#fb9678] shrink-0" />
                                    <span className="text-[9px] text-[#fb9678] truncate">AP {apCount}</span>
                                  </div>
                                )}
                                {hasOverdue && (
                                  <div className="flex items-center gap-0.5">
                                    <AlertTriangle className="h-2.5 w-2.5 text-red-500 shrink-0" />
                                    <span className="text-[9px] text-red-500">เกินกำหนด</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-4">
            <Card className="border-0 shadow-md" data-testid="card-detail">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#03c9d7]" />
                  {selectedDate
                    ? `เอกสารครบกำหนด ${formatDate(selectedDate, dateEra, dateFmt)}`
                    : "เลือกวันที่เพื่อดูรายละเอียด"
                  }
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!selectedDate ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    คลิกที่วันในปฏิทินเพื่อดูเอกสารที่ครบกำหนดชำระ
                  </div>
                ) : selectedItems.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    ไม่มีเอกสารครบกำหนดชำระในวันนี้
                  </div>
                ) : (
                  <div className="divide-y max-h-[500px] overflow-y-auto">
                    {selectedItems.map((item, idx) => {
                      const route = docRoute(item.docType, item.id);
                      return (
                        <div
                          key={`${item.docType}-${item.id}`}
                          className={`px-4 py-3 hover:bg-gray-50 transition-colors ${route ? "cursor-pointer" : ""}`}
                          onClick={() => route && navigate(route)}
                          data-testid={`detail-item-${idx}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <Badge className={`text-[9px] border-0 ${item.type === "AR" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                                {item.type}
                              </Badge>
                              <span className="text-xs font-semibold text-gray-800">{item.docNo}</span>
                            </div>
                            {paymentStatusBadge(item.paymentStatus)}
                          </div>
                          <div className="text-xs text-muted-foreground">{docTypeLabel(item.docType)}</div>
                          <div className="text-sm font-medium text-gray-700 mt-0.5">{item.contactName}</div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] text-muted-foreground">วันที่เอกสาร: {formatDate(item.docDate, dateEra, dateFmt)}</span>
                            <span className="text-sm font-bold" style={{ color: item.type === "AR" ? "var(--theme-primary)" : "#fb9678" }}>
                              ฿{fmt(item.totalAmount)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md mt-4" data-testid="card-legend">
              <CardContent className="p-4">
                <div className="text-xs font-semibold text-gray-600 mb-2">สัญลักษณ์</div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--theme-primary)]" />
                    <span className="text-gray-600">AR = ลูกหนี้ (เราต้องเก็บเงิน)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#fb9678]" />
                    <span className="text-gray-600">AP = เจ้าหนี้ (เราต้องจ่ายเงิน)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3 text-red-500" />
                    <span className="text-gray-600">เกินกำหนดชำระ</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded border-2 border-[#fb9678] bg-[#fb967810]" />
                    <span className="text-gray-600">วันนี้</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
