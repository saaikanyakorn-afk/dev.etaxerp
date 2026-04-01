import { useState, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import PosLayout from "@/components/pos-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/lib/company-context";
import { formatDate } from "@/lib/format";
import {
  Search, FileText, Eye, Download, Printer, MoreHorizontal, Plus, Minus,
  CheckCircle2, Clock, AlertCircle, Calendar as CalendarIcon, ShoppingCart, XCircle, AlertTriangle
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ThaiDateInput from "@/components/thai-date-input";
import { toLocalDateStr } from "@/lib/utils";

import { useDateSettings } from "@/hooks/use-date-settings";
const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "ร่าง", color: "bg-slate-100 text-slate-700 border-slate-200", icon: Clock },
  issued: { label: "ออกแล้ว", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  cancelled: { label: "ยกเลิก", color: "bg-red-100 text-red-700 border-red-200", icon: AlertCircle },
  voided: { label: "ยกเลิก(ถูกต้อง)", color: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertCircle },
};

function fmt(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PosSalesList() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [searchText, setSearchText] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const todayStr = toLocalDateStr(now);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [voidTarget, setVoidTarget] = useState<any>(null);

  const { dateEra, dateFmt } = useDateSettings();
  const { data: docSettings } = useQuery<any>({
    queryKey: ["/api/document-settings", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const res = await fetch(`/api/document-settings/${companyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
  });
  const { data: posSales = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/pos/sales", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const res = await fetch(`/api/pos/sales?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!companyId,
  });

  const voidMutation = useMutation({
    mutationFn: async (taxInvoiceId: number) => {
      const txnsRes = await fetch(`/api/pos/transactions?companyId=${companyId}`, { credentials: "include" });
      if (!txnsRes.ok) throw new Error("ไม่สามารถดึงข้อมูลรายการขาย");
      const txns = await txnsRes.json();
      const txn = txns.find((t: any) => t.taxInvoiceId === taxInvoiceId);
      if (!txn) throw new Error("ไม่พบรายการขายที่เชื่อมกับเอกสารนี้");
      const res = await fetch(`/api/pos/transactions/${txn.id}/void`, { method: "PATCH", credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "ยกเลิกรายการไม่สำเร็จ");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).includes("/api/pos") });
      setVoidTarget(null);
    },
  });

  const filtered = posSales.filter((inv: any) => {
    if (filterStatus && filterStatus !== "all" && inv.status !== filterStatus) return false;
    if (dateFrom && inv.taxInvoiceDate && inv.taxInvoiceDate < dateFrom) return false;
    if (dateTo && inv.taxInvoiceDate && inv.taxInvoiceDate > dateTo) return false;
    if (searchText) {
      const s = searchText.toLowerCase();
      if (
        !(inv.taxInvoiceNo || "").toLowerCase().includes(s) &&
        !(inv.customerName || "").toLowerCase().includes(s)
      ) return false;
    }
    return true;
  });

  const totalAmount = filtered.reduce((sum: number, inv: any) => sum + parseFloat(String(inv.totalAmount || "0")), 0);

  function toggleExpand(id: number) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportCSV() {
    const headers = ["ลำดับ", "วันที่", "เลขที่เอกสาร", "ลูกค้า", "สถานะ", "ยอดรวม"];
    const rows = filtered.map((inv: any, idx: number) => {
      const st = STATUS_MAP[inv.status] || STATUS_MAP.draft;
      return [
        idx + 1,
        inv.taxInvoiceDate || "",
        inv.taxInvoiceNo || "",
        inv.customerName || "",
        st.label,
        parseFloat(String(inv.totalAmount || "0")).toFixed(2),
      ];
    });
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `POS_sales_${toLocalDateStr(new Date())}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <PosLayout>
      <div className="space-y-4" data-testid="pos-sales-list-page">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-[#fb9678]" />
            <h1 className="text-2xl font-heading font-medium" data-testid="text-page-title">รายการขาย POS</h1>
            <span className="text-sm text-muted-foreground">ขายหน้าร้าน</span>
          </div>
        </div>

        <Card className="rounded border shadow-sm bg-white">
          <CardHeader className="p-3 border-b space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>{filtered.length} รายการ | ยอดรวม ฿{fmt(totalAmount)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-9 text-sm gap-1.5" onClick={exportCSV} data-testid="btn-export-csv">
                  <Download className="h-3.5 w-3.5" /> ส่งออก CSV
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  data-testid="input-search"
                  placeholder="ค้นหาเลขที่เอกสาร, ลูกค้า..."
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  className="h-8 text-sm pl-8 border rounded-lg bg-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">ช่วงวันที่:</span>
                <ThaiDateInput value={dateFrom} onChange={setDateFrom} dateEra={dateEra} dateFmt={dateFmt} className="w-[160px]" data-testid="input-date-from" />
                <span className="text-xs text-muted-foreground">ถึง</span>
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
              {(dateFrom || dateTo || (filterStatus && filterStatus !== "all") || searchText) && (
                <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => { setDateFrom(""); setDateTo(""); setFilterStatus("all"); setSearchText(""); }} data-testid="button-clear-filters">
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
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p className="text-sm">ยังไม่มีรายการขาย POS</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-100">
                  <TableRow className="hover:bg-transparent h-11">
                    <TableHead className="w-10 text-center text-sm font-medium text-slate-700"></TableHead>
                    <TableHead className="w-10 text-center text-sm font-medium text-slate-700">#</TableHead>
                    <TableHead className="w-28 text-sm font-medium text-slate-700">วันที่</TableHead>
                    <TableHead className="w-40 text-sm font-medium text-slate-700">เลขที่เอกสาร</TableHead>
                    <TableHead className="text-sm font-medium text-slate-700">ลูกค้า</TableHead>
                    <TableHead className="w-32 text-sm font-medium text-slate-700">ชำระโดย</TableHead>
                    <TableHead className="w-28 text-sm font-medium text-slate-700">สถานะ</TableHead>
                    <TableHead className="w-32 text-right text-sm font-medium text-slate-700">ยอดรวม</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((inv: any, idx: number) => {
                    const st = STATUS_MAP[inv.status] || STATUS_MAP.draft;
                    const StIcon = st.icon;
                    const isExpanded = expandedRows.has(inv.id);
                    return (
                      <Fragment key={inv.id}>
                        <TableRow data-testid={`row-pos-sale-${inv.id}`} className="hover:bg-slate-50/50 border-b">
                          <TableCell className="text-center py-3">
                            <button
                              data-testid={`button-expand-${inv.id}`}
                              onClick={() => toggleExpand(inv.id)}
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-white ${isExpanded ? "bg-gray-400" : "bg-[#fb9678]"}`}
                            >
                              {isExpanded ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                            </button>
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="text-sm">{formatDate(inv.taxInvoiceDate, dateEra, dateFmt)}</TableCell>
                          <TableCell>
                            <span className="text-sm text-[#e8734e] font-medium" data-testid={`text-doc-no-${inv.id}`}>
                              {inv.taxInvoiceNo}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-normal">{inv.customerName || "ลูกค้าทั่วไป"}</div>
                          </TableCell>
                          <TableCell className="text-sm">{inv.paymentMethod || "-"}</TableCell>
                          <TableCell>
                            <Badge data-testid={`badge-status-${inv.id}`} className={`${st.color} border text-xs py-0.5 px-2.5 font-normal h-6`}>
                              <StIcon className="h-3 w-3 mr-1" />
                              {st.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            <div className="text-sm font-normal">{fmt(inv.totalAmount)}</div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button data-testid={`button-actions-${inv.id}`} variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52 text-sm">
                                <DropdownMenuItem onClick={() => window.open(`/pos/receipt/${inv.id}`, "_blank")} className="flex gap-2">
                                  <Printer className="h-3.5 w-3.5 text-[#fb9678]" /> พิมพ์ใบกำกับอย่างย่อ
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => window.open(`/pos/invoice/${inv.id}`, "_blank")} className="flex gap-2">
                                  <Eye className="h-3.5 w-3.5 text-blue-500" /> ดูใบกำกับภาษีเต็มรูป
                                </DropdownMenuItem>
                                {inv.status !== "cancelled" && inv.status !== "voided" && (
                                  <DropdownMenuItem
                                    onClick={() => setVoidTarget(inv)}
                                    className="flex gap-2 text-red-600 focus:text-red-600"
                                    data-testid={`btn-void-${inv.id}`}
                                  >
                                    <XCircle className="h-3.5 w-3.5" /> ยกเลิกรายการ
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>

                        {isExpanded && (
                          <TableRow className="bg-slate-50/80">
                            <TableCell colSpan={9} className="p-4">
                              <PosExpandedDetail invId={inv.id} companyId={companyId!} />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!voidTarget} onOpenChange={(open) => { if (!open) setVoidTarget(null); }}>
        <AlertDialogContent data-testid="dialog-void-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" /> ยืนยันการยกเลิกรายการ
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm space-y-2">
              <p>คุณต้องการยกเลิกรายการขาย <strong className="text-slate-900">{voidTarget?.taxInvoiceNo}</strong> หรือไม่?</p>
              <p>ยอดเงิน: <strong className="text-slate-900">฿{fmt(voidTarget?.totalAmount)}</strong></p>
              <p className="text-red-500">การยกเลิกจะทำให้ใบกำกับภาษีที่เชื่อมกับรายการนี้ถูกยกเลิกด้วย</p>
              {voidMutation.error && (
                <p className="text-red-600 font-medium">{(voidMutation.error as Error).message}</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-void-cancel">ไม่ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              data-testid="btn-void-confirm"
              className="bg-red-600 hover:bg-red-700"
              disabled={voidMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (voidTarget) voidMutation.mutate(voidTarget.id);
              }}
            >
              {voidMutation.isPending ? "กำลังยกเลิก..." : "ยืนยันยกเลิก"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </PosLayout>
  );
}

function PosExpandedDetail({ invId, companyId }: { invId: number; companyId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/pos/sales", invId, companyId],
    queryFn: async () => {
      const res = await fetch(`/api/pos/sales/${invId}?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">กำลังโหลดรายละเอียด...</div>;
  if (!data) return <div className="text-sm text-red-500">ไม่พบข้อมูล</div>;

  const items = data.items || [];

  return (
    <div className="space-y-3">
      <div className="flex gap-6 text-sm text-slate-600">
        {data.paymentMethod && (
          <div><span className="text-slate-400 mr-1">ชำระ:</span>{data.paymentMethod}</div>
        )}
        {data.note && (
          <div><span className="text-slate-400 mr-1">หมายเหตุ:</span>{data.note}</div>
        )}
      </div>
      {items.length > 0 && (
        <table className="w-full text-sm border rounded overflow-hidden">
          <thead>
            <tr className="bg-slate-100 text-slate-600">
              <th className="text-left py-2 px-3 font-medium w-10">#</th>
              <th className="text-left py-2 px-3 font-medium">สินค้า</th>
              <th className="text-right py-2 px-3 font-medium w-20">จำนวน</th>
              <th className="text-right py-2 px-3 font-medium w-28">ราคา/หน่วย</th>
              <th className="text-right py-2 px-3 font-medium w-28">รวม</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, idx: number) => (
              <tr key={idx} className="border-t">
                <td className="py-2 px-3 text-muted-foreground">{idx + 1}</td>
                <td className="py-2 px-3">{item.productName}</td>
                <td className="py-2 px-3 text-right">{item.qty}</td>
                <td className="py-2 px-3 text-right">{fmt(item.unitPrice)}</td>
                <td className="py-2 px-3 text-right font-medium">{fmt(item.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-slate-50 font-medium">
              <td colSpan={4} className="py-2 px-3 text-right">รวมทั้งสิ้น</td>
              <td className="py-2 px-3 text-right text-[#fb9678]">{fmt(data.totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}
