import { useState, useEffect, Fragment } from "react";
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
  Search, Plus, Edit2, Trash2, Eye, Minus, Phone, Mail,
  CheckCircle2, Clock, XCircle, AlertCircle, Copy, MoreHorizontal, Scale, ArrowRight,
  BookOpen, ExternalLink, Calendar as CalendarIcon, Printer, Paperclip, FileDown
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RelatedDocsDialog from "@/components/related-docs-dialog";
import { parseAttachedUrl } from "@/components/multi-file-attachment";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";
import { formatDate } from "@/lib/format";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { toLocalDateStr } from "@/lib/utils";
import ListExportButton from "@/components/list-export-button";

const exportColumns = [
  { header: "วันที่", key: "bidDate", width: 14 },
  { header: "เลขที่", key: "bidNo", width: 20 },
  { header: "รายละเอียด", key: "description", width: 40 },
  { header: "สถานะ", key: "status", width: 14 },
];

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "รอเปรียบเทียบ", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  approved: { label: "อนุมัติ", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  rejected: { label: "ปฏิเสธ", color: "bg-red-100 text-red-700 border-red-200", icon: AlertCircle },
  selected: { label: "เลือกแล้ว", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  cancelled: { label: "ยกเลิก", color: "bg-gray-100 text-gray-700 border-gray-200", icon: XCircle },
};

function fmt(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BidComparisonList() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [searchText, setSearchText] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterBranch, setFilterBranch] = useState("all");
  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const todayStr = toLocalDateStr(now);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { dateEra, dateFmt } = useDateSettings();

  const { data: bidList = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/bid-comparisons", companyId, searchText],
    queryFn: async () => {
      if (!companyId) return [];
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (searchText) params.set("search", searchText);
      const res = await fetch(`/api/bid-comparisons?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!companyId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/bid-comparisons/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bid-comparisons"] });
      toast({ title: "ลบใบเปรียบเทียบราคาสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/bid-comparisons/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bid-comparisons"] });
      toast({ title: "เปลี่ยนสถานะสำเร็จ", variant: "success" as any });
    },
  });

  const handleClone = (id: number) => {
    navigate(`/purchases/bid/new?copyFrom=${id}`);
  };

  const branchOptions = Array.from(new Set(bidList.map((d: any) => d.sellerBranchId).filter(Boolean))) as string[];

  const filtered = bidList.filter((bid: any) => {
    if (filterStatus && filterStatus !== "all" && bid.status !== filterStatus) return false;
    if (filterBranch !== "all" && bid.sellerBranchId !== filterBranch) return false;
    if (dateFrom && bid.bidDate && bid.bidDate < dateFrom) return false;
    if (dateTo && bid.bidDate && bid.bidDate > dateTo) return false;
    if (searchText) {
      const s = searchText.toLowerCase();
      if (!(bid.bidNo || "").toLowerCase().includes(s) && !(bid.description || "").toLowerCase().includes(s) && !(bid.selectedVendorName || "").toLowerCase().includes(s)) return false;
    }
    return true;
  });

  function toggleExpand(id: number) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-6 w-6 text-[var(--theme-primary)]" />
            <h1 className="text-2xl font-heading font-medium" data-testid="text-page-title">เปรียบเทียบราคา</h1>
            <span className="text-sm text-muted-foreground">การซื้อ</span>
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
                <ListExportButton data={filtered} columns={exportColumns} fileName="เปรียบเทียบราคา" />
                <Button data-testid="button-create-bid" onClick={() => navigate("/purchases/bid/new")} className="h-9 text-sm px-4">
                  <Plus className="h-3.5 w-3.5 mr-1" /> สร้างเปรียบเทียบราคา
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
              {branchOptions.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">สาขา:</span>
                  <Select value={filterBranch} onValueChange={setFilterBranch}>
                    <SelectTrigger className="w-36 h-8 text-xs bg-white border rounded-lg" data-testid="select-filter-branch">
                      <SelectValue placeholder="ทั้งหมด" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      {branchOptions.map((b: string) => (
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
                <Scale className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p className="text-sm">ยังไม่มีใบเปรียบเทียบราคา</p>
                <Button variant="outline" className="mt-3" onClick={() => navigate("/purchases/bid/new")}>
                  <Plus className="h-4 w-4 mr-1" /> สร้างรายการแรก
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-[var(--theme-primary)]">
                  <TableRow className="hover:bg-transparent h-11">
                    <TableHead className="w-8 text-center text-sm font-medium text-white"></TableHead>
                    <TableHead className="w-8 text-center text-sm font-medium text-white">#</TableHead>
                    <TableHead className="w-[85px] text-sm font-medium text-white">วันที่</TableHead>
                    <TableHead className="w-[130px] text-sm font-medium text-white">BID # ⇅</TableHead>
                    <TableHead className="w-[90px] text-sm font-medium text-white">อ้างอิง PR</TableHead>
                    <TableHead className="text-sm font-medium text-white min-w-[280px]">รายละเอียด - {filtered.length} รายการ</TableHead>
                    <TableHead className="w-[120px] text-sm font-medium text-white">ผู้ขายที่เลือก</TableHead>
                    <TableHead className="w-[90px] text-center text-sm font-medium text-white">สถานะ</TableHead>
                    <TableHead className="w-[110px] text-right text-sm font-medium text-white">ยอดรวม</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((bid: any, idx: number) => {
                    const st = STATUS_MAP[bid.status] || { label: bid.status || "ไม่ทราบ", color: "bg-gray-100 text-gray-600 border-gray-200", icon: Clock };
                    const StIcon = st.icon;
                    const isExpanded = expandedRows.has(bid.id);
                    return (
                      <Fragment key={bid.id}>
                        <TableRow data-testid={`row-bid-${bid.id}`} className="hover:bg-slate-50/50 border-b">
                          <TableCell className="text-center py-3">
                            <button
                              data-testid={`button-expand-${bid.id}`}
                              onClick={() => toggleExpand(bid.id)}
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-white ${isExpanded ? "bg-gray-400" : "bg-[var(--theme-primary)]"}`}
                            >
                              {isExpanded ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                            </button>
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="text-sm">{formatDate(bid.bidDate, dateEra, dateFmt)}</TableCell>
                          <TableCell>
                            <button
                              data-testid={`link-bid-${bid.id}`}
                              className="text-sm text-[#03c9d7] hover:underline font-medium"
                              onClick={() => navigate(`/purchases/bid/edit/${bid.id}`)}
                            >
                              {bid.bidNo}
                            </button>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{bid.prRef || "-"}</TableCell>
                          <TableCell className="text-sm">{bid.description || "-"}</TableCell>
                          <TableCell className="text-sm">
                            {bid.selectedVendorName ? (
                              <span className="text-[#05b187]">{bid.selectedVendorName}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge data-testid={`badge-status-${bid.id}`} className={`${st.color} border text-xs py-0.5 px-2.5 font-normal h-6`}>
                              <StIcon className="h-3 w-3 mr-1" />
                              {st.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            <div className="text-sm font-normal">{fmt(bid.totalAmount)}</div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button data-testid={`button-actions-${bid.id}`} variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56 text-sm">
                                <DropdownMenuItem onClick={() => navigate(`/purchases/bid/edit/${bid.id}`)} className="flex gap-2">
                                  <Edit2 className="h-3.5 w-3.5" /> แก้ไข
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => window.open(`/purchases/bid/edit/${bid.id}`, '_blank')} className="flex gap-2">
                                  <Printer className="h-3.5 w-3.5 text-purple-500" /> ดูตัวอย่าง / สั่งพิมพ์
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleClone(bid.id)} className="flex gap-2">
                                  <Copy className="h-3.5 w-3.5" /> คัดลอกเอกสาร
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {bid.status === "pending" && (
                                  <DropdownMenuItem onClick={() => statusMutation.mutate({ id: bid.id, status: "selected" })} className="flex gap-2 text-emerald-600">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> เลือกผู้ขาย
                                  </DropdownMenuItem>
                                )}
                                {bid.status !== "cancelled" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => statusMutation.mutate({ id: bid.id, status: "cancelled" })} className="flex gap-2 text-gray-500">
                                      <XCircle className="h-3.5 w-3.5" /> ยกเลิก
                                    </DropdownMenuItem>
                                  </>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => navigate(`/purchases/po/new?fromBID=${bid.id}`)} className="flex gap-2 text-emerald-600">
                                  <ArrowRight className="h-3.5 w-3.5" /> สร้างใบสั่งซื้อ
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (confirm("ยืนยันลบใบเปรียบเทียบราคานี้?")) {
                                      deleteMutation.mutate(bid.id);
                                    }
                                  }}
                                  className="flex gap-2 text-red-500"
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> ลบเอกสาร
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>

                        {isExpanded && (
                          <TableRow className="bg-slate-50/80">
                            <TableCell colSpan={10} className="p-4">
                              <ExpandedDetail doc={bid} />
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
    </Layout>
  );
}

function ExpandedDetail({ doc }: { doc: any }) {
  const [items, setItems] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [loadingItems, setLoadingItems] = useState(true);
  const [relatedOpen, setRelatedOpen] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/bid-comparisons/${doc.id}`, { credentials: "include" });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setItems(data.items || []);
          setDetail(data);
        }
      } catch {}
      if (!cancelled) setLoadingItems(false);
    })();
    return () => { cancelled = true; };
  }, [doc.id]);

  return (
    <div className="space-y-3">
      <div className="flex gap-8 text-sm text-slate-600">
        {doc.description && (
          <div className="flex-1">
            <span className="text-slate-500">รายละเอียด:</span> {doc.description}
          </div>
        )}
        {doc.notes && (
          <div className="text-right">
            <span className="text-slate-500">หมายเหตุ: {doc.notes}</span>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="border rounded overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[var(--theme-primary)] hover:bg-[var(--theme-primary)] h-10">
                <TableHead className="text-white text-sm font-medium w-20">รหัส</TableHead>
                <TableHead className="text-white text-sm font-medium">สินค้า</TableHead>
                <TableHead className="text-white text-sm font-medium w-24 text-right">ราคา</TableHead>
                <TableHead className="text-white text-sm font-medium w-16 text-center">จำนวน</TableHead>
                <TableHead className="text-white text-sm font-medium w-16 text-center">ส่วนลด</TableHead>
                <TableHead className="text-white text-sm font-medium w-24 text-right">รวม</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it: any, i: number) => (
                <TableRow key={i} className="h-10 hover:bg-sky-50/50">
                  <TableCell className="text-sm text-muted-foreground">{it.productCode || "-"}</TableCell>
                  <TableCell className="text-sm">{it.productName}</TableCell>
                  <TableCell className="text-sm text-right">{fmt(it.unitPrice)}</TableCell>
                  <TableCell className="text-sm text-center">{it.quantity || it.qty} {it.unit || ""}</TableCell>
                  <TableCell className="text-sm text-center">{it.discount ? `${it.discount}%` : "-"}</TableCell>
                  <TableCell className="text-sm text-right font-medium">{fmt(it.totalPrice || it.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {loadingItems && <div className="text-xs text-muted-foreground text-center py-2">กำลังโหลดรายการ...</div>}

      {detail && (
        <div className="flex justify-end">
          <div className="text-sm space-y-0.5 text-right min-w-[200px]">
            <div className="flex justify-between"><span className="text-slate-500">ราคารวม:</span><span>{fmt(detail.subtotalAmount || detail.subtotal)}</span></div>
            {(detail.discountAmount || 0) > 0 && (
              <div className="flex justify-between text-red-500"><span>ส่วนลด:</span><span>-{fmt(detail.discountAmount)}</span></div>
            )}
            <div className="flex justify-between"><span className="text-slate-500">ก่อน VAT:</span><span>{fmt(detail.beforeVatAmount || detail.subtotalAmount || detail.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">VAT {detail.vatRate || 7}%:</span><span>{fmt(detail.vatAmount)}</span></div>
            <div className="flex justify-between font-medium border-t pt-1 mt-1"><span>ยอดสุทธิ:</span><span>{fmt(detail.totalAmount)}</span></div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
        <button
          data-testid={`button-journal-${doc.id}`}
          onClick={async () => {
            const res = await fetch(`/api/journal-entries/by-source/bid-comparison/${doc.id}`, { credentials: 'include' });
            if (res.ok) { const j = await res.json(); if (j?.id) navigate('/journal/edit/' + j.id); }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-[var(--theme-primary)]/30 text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/10 transition-colors"
        >
          <Edit2 className="w-3.5 h-3.5" />
          แก้ไขการลงบัญชี
        </button>
        <button
          data-testid={`button-related-${doc.id}`}
          onClick={() => setRelatedOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-[#03c9d7]/30 text-[#03c9d7] hover:bg-[#03c9d7]/10 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          เอกสารที่เกี่ยวข้อง
        </button>
      </div>

      {doc.attachedUrl && (() => {
        const files = parseAttachedUrl(doc.attachedUrl);
        if (files.length === 0) return null;
        return (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Paperclip className="w-3.5 h-3.5 text-slate-400" />
            {files.map((file: any, idx: number) => (
              <a
                key={idx}
                href={file.path}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[var(--theme-primary)] hover:underline"
                data-testid={`attachment-file-${doc.id}-${idx}`}
              >
                <FileDown className="w-3 h-3" />
                แนบ {idx + 1}
              </a>
            ))}
          </div>
        );
      })()}

      <RelatedDocsDialog open={relatedOpen} onOpenChange={setRelatedOpen} docType="bid-comparison" docId={doc.id} />
    </div>
  );
}
