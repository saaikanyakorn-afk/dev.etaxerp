import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import {
  Search, Plus, FileText, Edit2, Trash2, Clock,
  CheckCircle2, MoreHorizontal, Calendar as CalendarIcon,
  AlertCircle, XCircle
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";
import { toDisplayDate } from "@/components/ui/date-picker";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { toLocalDateStr } from "@/lib/utils";
import ListExportButton from "@/components/list-export-button";

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "ร่าง", color: "bg-slate-100 text-slate-700 border-slate-200", icon: Clock },
  pending_approval: { label: "รออนุมัติ", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  approved: { label: "อนุมัติ", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  rejected: { label: "ปฏิเสธ", color: "bg-red-100 text-red-700 border-red-200", icon: AlertCircle },
  cancelled: { label: "ยกเลิก", color: "bg-gray-100 text-gray-700 border-gray-200", icon: XCircle },
  paid: { label: "ชำระแล้ว", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
};

const DEPOSIT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  available: { label: "พร้อมใช้", color: "bg-blue-100 text-blue-700 border-blue-200" },
  partial: { label: "ใช้บางส่วน", color: "bg-amber-100 text-amber-700 border-amber-200" },
  used: { label: "ใช้หมดแล้ว", color: "bg-slate-100 text-slate-500 border-slate-200" },
};

function fmt(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DepositList() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [searchText, setSearchText] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterBranch, setFilterBranch] = useState("all");
  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const todayStr = toLocalDateStr(now);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { dateEra, dateFmt } = useDateSettings();

  const { data: deposits = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/deposit-receipts", companyId, searchText],
    queryFn: async () => {
      if (!companyId) return [];
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (searchText) params.set("search", searchText);
      const res = await fetch(`/api/deposit-receipts?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!companyId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/deposit-receipts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deposit-receipts"] });
      toast({ title: "ลบใบรับเงินมัดจำสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const filtered = deposits.filter((d: any) => {
    if (filterStatus && filterStatus !== "all" && d.status !== filterStatus) return false;
    if (filterBranch !== "all" && d.sellerBranchId !== filterBranch) return false;
    if (dateFrom && d.depositDate && d.depositDate < dateFrom) return false;
    if (dateTo && d.depositDate && d.depositDate > dateTo) return false;
    if (searchText) {
      const s = searchText.toLowerCase();
      if (!(d.depositNo || "").toLowerCase().includes(s) && !(d.customerName || "").toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const branchOptions = Array.from(new Set(deposits.map((d: any) => d.sellerBranchId).filter(Boolean))) as string[];

  const exportColumns = [
    { header: "วันที่", key: "depositDate", width: 14 },
    { header: "เลขที่", key: "depositNo", width: 20 },
    { header: "ลูกค้า", key: "customerName", width: 25 },
    { header: "ยอดรวม", key: "totalAmount", width: 16, format: "number" as const },
    { header: "สถานะ", key: "status", width: 12 },
  ];

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-[var(--theme-primary)]" />
            <h1 className="text-2xl font-heading font-medium" data-testid="text-page-title">ใบรับเงินมัดจำ</h1>
            <span className="text-sm text-muted-foreground">[DP]</span>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded px-3 py-1.5">
          <Badge className="bg-red-500 text-white text-sm">Analysis</Badge>
          <div className="relative flex-1">
            <Input
              data-testid="input-search"
              placeholder="คำค้นหา..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="h-9 text-sm pl-3 pr-8 border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
          </div>
          <Button data-testid="button-search" variant="secondary" size="sm" className="h-9 text-sm px-4">
            <Search className="h-3.5 w-3.5 mr-1" /> ค้นหา
          </Button>
        </div>

        <Card className="rounded border shadow-sm bg-white">
          <CardHeader className="p-3 border-b space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>รายละเอียด - {filtered.length} รายการ</span>
              </div>
              <div className="flex items-center gap-2">
                <ListExportButton data={filtered} columns={exportColumns} fileName="ใบรับเงินมัดจำ" />
                <Button data-testid="button-create" onClick={() => navigate("/sales/deposit/new")} className="h-9 text-sm px-4">
                  <Plus className="h-3.5 w-3.5 mr-1" /> สร้างใบรับเงินมัดจำ
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">ช่วงวันที่:</span>
                <ThaiDateInput value={dateFrom} onChange={setDateFrom} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-date-from" />
                <span className="text-xs text-gray-500">ถึง</span>
                <ThaiDateInput value={dateTo} onChange={setDateTo} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-date-to" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">สถานะ:</span>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-36 h-8 text-xs bg-white border rounded-lg" data-testid="select-filter-status">
                    <SelectValue placeholder="ทั้งหมด" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    {Object.entries(STATUS_MAP).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {branchOptions.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">สาขา:</span>
                  <Select value={filterBranch} onValueChange={setFilterBranch}>
                    <SelectTrigger className="w-36 h-8 text-xs bg-white border rounded-lg" data-testid="select-filter-branch">
                      <SelectValue placeholder="ทั้งหมด" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      {branchOptions.map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(dateFrom || dateTo || (filterStatus && filterStatus !== "all") || filterBranch !== "all") && (
                <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => { setDateFrom(""); setDateTo(""); setFilterStatus("all"); setFilterBranch("all"); }} data-testid="button-clear-filters">
                  ล้างตัวกรอง
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">กำลังโหลด...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p className="text-sm">ยังไม่มีใบรับเงินมัดจำ</p>
                <Button variant="outline" className="mt-3" onClick={() => navigate("/sales/deposit/new")}>
                  <Plus className="h-4 w-4 mr-1" /> สร้างรายการแรก
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-[var(--theme-primary)]">
                  <TableRow className="hover:bg-transparent h-11">
                    <TableHead className="w-8 text-center text-sm font-medium text-white">#</TableHead>
                    <TableHead className="w-[130px] text-sm font-medium text-white">DP #</TableHead>
                    <TableHead className="w-[85px] text-sm font-medium text-white">วันที่</TableHead>
                    <TableHead className="text-sm font-medium text-white min-w-[280px]">รายละเอียด - {filtered.length} รายการ</TableHead>
                    <TableHead className="w-[110px] text-right text-sm font-medium text-white">จำนวนเงิน</TableHead>
                    <TableHead className="w-[110px] text-right text-sm font-medium text-white">ยอดคงเหลือ</TableHead>
                    <TableHead className="w-[90px] text-center text-sm font-medium text-white">สถานะมัดจำ</TableHead>
                    <TableHead className="w-[90px] text-center text-sm font-medium text-white">สถานะ</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((dep: any, idx: number) => {
                    const st = STATUS_MAP[dep.status] || { label: dep.status || "ไม่ทราบ", color: "bg-gray-100 text-gray-600 border-gray-200", icon: Clock };
                    const StIcon = st.icon;
                    const depositStatus = dep.depositStatus || "available";
                    const ds = DEPOSIT_STATUS_MAP[depositStatus] || DEPOSIT_STATUS_MAP.available;
                    return (
                      <TableRow key={dep.id} data-testid={`row-deposit-${dep.id}`} className="hover:bg-slate-50/50 border-b">
                        <TableCell className="text-center text-sm text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>
                          <button
                            data-testid={`link-deposit-${dep.id}`}
                            className="text-sm text-[#e8734e] hover:underline font-medium"
                            onClick={() => navigate(`/sales/deposit/edit/${dep.id}`)}
                          >
                            {dep.depositNo}
                          </button>
                        </TableCell>
                        <TableCell className="text-sm">{toDisplayDate(dep.depositDate, dateFmt as any, dateEra)}</TableCell>
                        <TableCell>
                          <div className="text-sm font-normal">{dep.customerName}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <div className="text-sm font-normal">
                            {fmt(dep.totalAmount)}
                            {dep.currencyCode && dep.currencyCode !== "THB" && (
                              <span className="text-[10px] ml-1 text-[var(--theme-primary)] font-normal">{dep.currencyCode}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <div className="text-sm font-normal">{fmt(dep.remainingAmount ?? dep.totalAmount)}</div>
                        </TableCell>
                        <TableCell>
                          <Badge data-testid={`badge-deposit-status-${dep.id}`} className={`${ds.color} border text-xs py-0.5 px-2.5 font-normal h-6`}>
                            {ds.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge data-testid={`badge-status-${dep.id}`} className={`${st.color} border text-xs py-0.5 px-2.5 font-normal h-6`}>
                            <StIcon className="h-3 w-3 mr-1" />
                            {st.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button data-testid={`button-actions-${dep.id}`} variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 text-sm">
                              <DropdownMenuItem onClick={() => navigate(`/sales/deposit/edit/${dep.id}`)} className="flex gap-2">
                                <Edit2 className="h-3.5 w-3.5" /> แก้ไข
                              </DropdownMenuItem>
                              {dep.status === "draft" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      if (confirm("ต้องการลบใบรับเงินมัดจำนี้หรือไม่?")) {
                                        deleteMutation.mutate(dep.id);
                                      }
                                    }}
                                    className="flex gap-2 text-red-600"
                                    data-testid={`button-delete-${dep.id}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" /> ลบ
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}