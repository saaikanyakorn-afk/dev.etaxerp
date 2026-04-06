import { useState, Fragment } from "react";
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
  Search, Plus, FileText, Edit2, Trash2, Eye,
  CheckCircle2, Clock, XCircle, AlertCircle, MoreHorizontal, Calendar as CalendarIcon
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
import { useBulkDelete } from "@/hooks/use-bulk-delete";
import { BulkDeleteButton, BulkDeleteConfirmDialog, SelectAllCheckbox, RowCheckbox } from "@/components/bulk-delete-bar";
import { formatDate } from "@/lib/format";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { toLocalDateStr } from "@/lib/utils";

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "ร่าง", color: "bg-slate-100 text-slate-700 border-slate-200", icon: Clock },
  approved: { label: "อนุมัติ", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  pending_approval: { label: "รออนุมัติ", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  rejected: { label: "ปฏิเสธ", color: "bg-red-100 text-red-700 border-red-200", icon: AlertCircle },
  cancelled: { label: "ยกเลิก", color: "bg-gray-100 text-gray-700 border-gray-200", icon: XCircle },
};

function fmt(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DebitNoteList() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [searchText, setSearchText] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("search") || "";
  });
  const [filterStatus, setFilterStatus] = useState("all");
  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const todayStr = toLocalDateStr(now);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const bulk = useBulkDelete({ endpoint: "/api/purchase-debit-notes/bulk-delete", queryKey: "/api/purchase-debit-notes", docLabel: "ใบลดหนี้ซื้อ", companyId });
  const { dateEra, dateFmt } = useDateSettings();

  const { data: debitNotes = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/purchase-debit-notes", companyId, searchText],
    queryFn: async () => {
      if (!companyId) return [];
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (searchText) params.set("search", searchText);
      const res = await fetch(`/api/purchase-debit-notes?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!companyId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/purchase-debit-notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-debit-notes"] });
      toast({ title: "ลบใบลดหนี้ซื้อสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const filtered = debitNotes.filter((dn: any) => {
    if (filterStatus && filterStatus !== "all" && dn.status !== filterStatus) return false;
    if (dateFrom && dn.debitNoteDate && dn.debitNoteDate < dateFrom) return false;
    if (dateTo && dn.debitNoteDate && dn.debitNoteDate > dateTo) return false;
    if (searchText) {
      const s = searchText.toLowerCase();
      if (!(dn.debitNoteNo || "").toLowerCase().includes(s) && !(dn.vendorName || "").toLowerCase().includes(s)) return false;
    }
    return true;
  });

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6" style={{ color: 'var(--theme-primary)' }} />
            <h1 className="text-2xl font-heading font-medium" data-testid="text-page-title">ใบลดหนี้ซื้อ [DN]</h1>
            <span className="text-sm text-muted-foreground">ซื้อ</span>
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
                {bulk.selectedIds.size > 0 && <span className="text-red-500 font-medium ml-2">เลือก {bulk.selectedIds.size} รายการ</span>}
              </div>
              <div className="flex items-center gap-2">
                <BulkDeleteButton count={bulk.selectedIds.size} isPending={bulk.isPending} onClick={() => bulk.setShowConfirm(true)} />
                <Button data-testid="button-create" onClick={() => navigate("/purchases/debit-note/new")} className="h-9 text-sm px-4">
                  <Plus className="h-3.5 w-3.5 mr-1" /> สร้างใบลดหนี้ซื้อ
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
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
              {(dateFrom || dateTo || (filterStatus && filterStatus !== "all")) && (
                <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => { setDateFrom(""); setDateTo(""); setFilterStatus("all"); }} data-testid="button-clear-filters">
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
                <p className="text-sm">ยังไม่มีใบลดหนี้ซื้อ</p>
                <Button variant="outline" className="mt-3" onClick={() => navigate("/purchases/debit-note/new")}>
                  <Plus className="h-4 w-4 mr-1" /> สร้างรายการแรก
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader style={{ backgroundColor: '#fec90f' }}>
                  <TableRow className="hover:bg-transparent h-11">
                    <TableHead className="w-8 text-center text-sm font-medium text-white">
                      <SelectAllCheckbox checked={filtered.length > 0 && bulk.selectedIds.size === filtered.length} onCheckedChange={(c) => c ? bulk.selectAll(filtered.map((dn: any) => dn.id)) : bulk.clearSelection()} />
                    </TableHead>
                    <TableHead className="w-8 text-center text-sm font-medium text-white">#</TableHead>
                    <TableHead className="w-[130px] text-sm font-medium text-white">DN #</TableHead>
                    <TableHead className="w-[85px] text-sm font-medium text-white">วันที่</TableHead>
                    <TableHead className="text-sm font-medium text-white min-w-[280px]">รายละเอียด - {filtered.length} รายการ</TableHead>
                    <TableHead className="w-[130px] text-sm font-medium text-white">อ้างอิงเอกสารซื้อ</TableHead>
                    <TableHead className="w-[110px] text-right text-sm font-medium text-white">จำนวนเงิน</TableHead>
                    <TableHead className="w-[90px] text-center text-sm font-medium text-white">สถานะ</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((dn: any, idx: number) => {
                    const st = STATUS_MAP[dn.status] || { label: dn.status || "ไม่ทราบ", color: "bg-gray-100 text-gray-600 border-gray-200", icon: Clock };
                    const StIcon = st.icon;
                    return (
                      <TableRow key={dn.id} data-testid={`row-debit-note-${dn.id}`} className={`hover:bg-slate-50/50 border-b ${bulk.selectedIds.has(dn.id) ? "bg-red-50/50" : ""}`}>
                        <TableCell className="text-center text-sm">
                          <RowCheckbox id={dn.id} checked={bulk.selectedIds.has(dn.id)} onCheckedChange={() => bulk.toggleSelect(dn.id)} />
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>
                          <button
                            data-testid={`link-debit-note-${dn.id}`}
                            className="text-sm text-[#e8734e] hover:underline font-medium"
                            onClick={() => navigate(`/purchases/debit-note/edit/${dn.id}`)}
                          >
                            {dn.debitNoteNo || "-"}
                          </button>
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(dn.debitNoteDate, dateEra, dateFmt)}</TableCell>
                        <TableCell>
                          <div className="text-sm font-normal">{dn.vendorName}</div>
                        </TableCell>
                        <TableCell className="text-sm">{dn.refPurchaseInvoiceNo || "-"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          <div className="text-sm font-normal">
                            {fmt(dn.totalAmount)}
                            {dn.currencyCode && dn.currencyCode !== "THB" && (
                              <span className="text-[10px] ml-1 font-normal" style={{ color: 'var(--theme-primary)' }}>{dn.currencyCode}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge data-testid={`badge-status-${dn.id}`} className={`${st.color} border text-xs py-0.5 px-2.5 font-normal h-6`}>
                            <StIcon className="h-3 w-3 mr-1" />
                            {st.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button data-testid={`button-actions-${dn.id}`} variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 text-sm">
                              <DropdownMenuItem onClick={() => navigate(`/purchases/debit-note/edit/${dn.id}`)} className="flex gap-2">
                                  <Edit2 className="h-3.5 w-3.5" /> แก้ไข
                                </DropdownMenuItem>
                              {dn.status === "draft" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      if (confirm("ยืนยันลบใบลดหนี้ซื้อนี้?")) {
                                        deleteMutation.mutate(dn.id);
                                      }
                                    }}
                                    className="flex gap-2 text-red-500"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" /> ลบเอกสาร
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
      <BulkDeleteConfirmDialog open={bulk.showConfirm} onOpenChange={bulk.setShowConfirm} count={bulk.selectedIds.size} docLabel="ใบลดหนี้ซื้อ" onConfirm={bulk.confirmDelete} />
    </Layout>
  );
}
