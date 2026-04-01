import EcommerceLayout from "@/components/ecommerce-layout";
import { getPlatformLogo } from "@/lib/platform-logos";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ClipboardCheck, CheckCircle, ShoppingCart, FileCheck, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { formatDate } from "@/lib/format";
import { useState, useMemo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

import { useDateSettings } from "@/hooks/use-date-settings";
const PLATFORMS = [
  { value: "shopee", label: "Shopee", hex: "#EE4D2D", bgLight: "bg-orange-100", textColor: "text-orange-700" },
  { value: "lazada", label: "Lazada", hex: "#0F146D", bgLight: "bg-indigo-100", textColor: "text-indigo-700" },
  { value: "tiktok", label: "TikTok Shop", hex: "#000000", bgLight: "bg-gray-100", textColor: "text-gray-900" },
  { value: "amazon", label: "Amazon", hex: "#FF9900", bgLight: "bg-amber-100", textColor: "text-amber-700" },
];

const THAI_MONTHS = [
  { value: "1", label: "มกราคม" }, { value: "2", label: "กุมภาพันธ์" },
  { value: "3", label: "มีนาคม" }, { value: "4", label: "เมษายน" },
  { value: "5", label: "พฤษภาคม" }, { value: "6", label: "มิถุนายน" },
  { value: "7", label: "กรกฎาคม" }, { value: "8", label: "สิงหาคม" },
  { value: "9", label: "กันยายน" }, { value: "10", label: "ตุลาคม" },
  { value: "11", label: "พฤศจิกายน" }, { value: "12", label: "ธันวาคม" },
];

const ORDER_STATUSES = [
  { value: "pending", label: "รอดำเนินการ", className: "bg-orange-100 text-orange-800 hover:bg-orange-100" },
  { value: "confirmed", label: "ยืนยันแล้ว", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  { value: "shipping", label: "กำลังจัดส่ง", className: "bg-purple-100 text-purple-800 hover:bg-purple-100" },
  { value: "shipped", label: "จัดส่งแล้ว", className: "bg-cyan-100 text-cyan-800 hover:bg-cyan-100" },
  { value: "delivered", label: "สำเร็จ", className: "bg-green-100 text-green-800 hover:bg-green-100" },
  { value: "cancelled", label: "ยกเลิก", className: "bg-red-100 text-red-800 hover:bg-red-100" },
];

function platformBadge(platform: string) {
    const p = PLATFORMS.find(pl => pl.value === platform);
    if (!p) return <Badge data-testid={`badge-platform-${platform}`} className="bg-gray-100 text-gray-700 hover:bg-gray-100">{platform}</Badge>;
    const logo = getPlatformLogo(platform);
    return (
      <Badge data-testid={`badge-platform-${platform}`} className={`${p.bgLight} ${p.textColor} hover:${p.bgLight}`}>
        {logo && <img src={logo} alt={p.label} className="w-4 h-4 rounded-full object-cover" />}
        {p.label}
      </Badge>
    );
  }

function orderStatusBadge(status: string) {
  const s = ORDER_STATUSES.find(os => os.value === status);
  if (!s) return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">{status}</Badge>;
  return <Badge data-testid={`badge-order-status-${status}`} className={s.className}>{s.label}</Badge>;
}

function formatCurrency(v: string | number | null | undefined) {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getCompletionColor(rate: number) {
  if (rate >= 100) return "#05b187";
  if (rate >= 80) return "#fec90f";
  return "#f94d4d";
}

interface ReconciliationSummary {
  totalOrders: number;
  issuedCount: number;
  missingCount: number;
  cancelledCount: number;
  completionRate: number;
  totalAmount: number;
  issuedAmount: number;
  missingAmount: number;
}

interface PlatformBreakdown {
  total: number;
  issued: number;
  missing: number;
  cancelled: number;
  totalAmount: number;
  issuedAmount: number;
  missingAmount: number;
}

interface MissingOrder {
  id: number;
  orderNo: string;
  platform: string;
  buyerName: string;
  totalAmount: string;
  status: string;
  placedAt: string;
  trackingNo: string;
}

interface ReconciliationData {
  summary: ReconciliationSummary;
  byPlatform: Record<string, PlatformBreakdown>;
  missingOrders: MissingOrder[];
}

export default function EcommerceReconciliation() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { dateEra, dateFmt } = useDateSettings();
  const { data: docSettings } = useQuery<any>({
    queryKey: ["/api/document-settings", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return null;
      const res = await fetch(`/api/document-settings?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [platformFilter, setPlatformFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const currentYear = now.getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  const { data, isLoading } = useQuery<ReconciliationData>({
    queryKey: ["/api/ecommerce/reconciliation", selectedCompanyId, month, year, platformFilter],
    queryFn: async () => {
      let url = `/api/ecommerce/reconciliation?companyId=${selectedCompanyId}&month=${month}&year=${year}`;
      if (platformFilter !== "all") url += `&platform=${platformFilter}`;
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) return { summary: { totalOrders: 0, issuedCount: 0, missingCount: 0, cancelledCount: 0, completionRate: 0, totalAmount: 0, issuedAmount: 0, missingAmount: 0 }, byPlatform: {}, missingOrders: [] };
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const summary = data?.summary || { totalOrders: 0, issuedCount: 0, missingCount: 0, cancelledCount: 0, completionRate: 0, totalAmount: 0, issuedAmount: 0, missingAmount: 0 };
  const byPlatform = data?.byPlatform || {};
  const missingOrders = data?.missingOrders || [];

  const batchGenerateMutation = useMutation({
    mutationFn: async (orderIds: number[]) => {
      const r = await fetch(`/api/ecommerce/orders/batch-generate-documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderIds, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/reconciliation"] });
      setSelectedIds(new Set());
      toast({ title: `ออกใบกำกับภาษีสำเร็จ ${data.success || 0} รายการ`, variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const allSelected = useMemo(
    () => missingOrders.length > 0 && missingOrders.every(o => selectedIds.has(o.id)),
    [missingOrders, selectedIds]
  );

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(missingOrders.map(o => o.id)));
  }, [missingOrders]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  function handleBatchGenerate() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast({ title: "กรุณาเลือกคำสั่งซื้อ", variant: "destructive" });
      return;
    }
    batchGenerateMutation.mutate(ids);
  }

  const completionColor = getCompletionColor(summary.completionRate);

  return (
    <EcommerceLayout>
      <div className="space-y-4" data-testid="page-ecommerce-reconciliation">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "#fff3ef" }}>
            <ClipboardCheck className="h-5 w-5" style={{ color: "#fb9678" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="text-reconciliation-title">ตรวจสอบใบกำกับภาษี</h1>
            <p className="text-sm text-muted-foreground">ตรวจสอบความครบถ้วนของการออกใบกำกับภาษีจากทุกแพลตฟอร์ม</p>
          </div>
        </div>

        <Card className="rounded-xl shadow-sm border" data-testid="card-filters">
          <CardContent className="py-3 px-4">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={month} onValueChange={v => { setMonth(v); setSelectedIds(new Set()); }} data-testid="select-month">
                <SelectTrigger className="w-[160px] h-8 text-xs" data-testid="trigger-month-filter">
                  <SelectValue placeholder="เดือน" />
                </SelectTrigger>
                <SelectContent>
                  {THAI_MONTHS.map(m => (
                    <SelectItem key={m.value} value={m.value} data-testid={`option-month-${m.value}`}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={year} onValueChange={v => { setYear(v); setSelectedIds(new Set()); }} data-testid="select-year">
                <SelectTrigger className="w-[120px] h-8 text-xs" data-testid="trigger-year-filter">
                  <SelectValue placeholder="ปี" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(y => (
                    <SelectItem key={y} value={String(y)} data-testid={`option-year-${y}`}>{y + 543}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={platformFilter} onValueChange={v => { setPlatformFilter(v); setSelectedIds(new Set()); }}>
                <SelectTrigger className="w-[160px] h-8 text-xs" data-testid="trigger-platform-filter">
                  <SelectValue placeholder="แพลตฟอร์ม" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-platform-all">ทุกแพลตฟอร์ม</SelectItem>
                  {PLATFORMS.map(p => (
                    <SelectItem key={p.value} value={p.value} data-testid={`option-platform-${p.value}`}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-20" data-testid="loading-spinner">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Card className="rounded-xl shadow-sm border" data-testid="card-completion-rate">
              <CardContent className="py-6 px-6">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="relative h-32 w-32 shrink-0">
                    <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                      <circle
                        cx="60" cy="60" r="50" fill="none"
                        stroke={completionColor}
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={`${Math.min(summary.completionRate, 100) * 3.14} 314`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold" style={{ color: completionColor }} data-testid="text-completion-rate">
                        {summary.completionRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="text-center md:text-left">
                    <h2 className="text-lg font-semibold text-gray-800" data-testid="text-completion-label">อัตราความครบถ้วน</h2>
                    <p className="text-sm text-muted-foreground mt-1" data-testid="text-completion-detail">
                      ออกใบกำกับภาษีแล้ว <span className="font-semibold" style={{ color: "#05b187" }}>{summary.issuedCount}</span> จาก <span className="font-semibold">{summary.totalOrders - summary.cancelledCount}</span> คำสั่งซื้อ
                      {summary.cancelledCount > 0 && (
                        <span className="text-muted-foreground"> (ไม่รวมยกเลิก {summary.cancelledCount} รายการ)</span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="rounded-xl shadow-sm border" data-testid="card-total-orders">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "#eef4ff" }}>
                      <ShoppingCart className="h-5 w-5" style={{ color: "#539BFF" }} />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">คำสั่งซื้อทั้งหมด</div>
                      <div className="text-xl font-bold" style={{ color: "#539BFF" }} data-testid="text-total-orders">{summary.totalOrders}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-xl shadow-sm border" data-testid="card-issued-count">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "#e6f9f1" }}>
                      <FileCheck className="h-5 w-5" style={{ color: "#05b187" }} />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">ออกเอกสารแล้ว</div>
                      <div className="text-xl font-bold" style={{ color: "#05b187" }} data-testid="text-issued-count">{summary.issuedCount}</div>
                      <div className="text-xs text-muted-foreground" data-testid="text-issued-amount">฿{formatCurrency(summary.issuedAmount)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-xl shadow-sm border" data-testid="card-missing-count">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "#fef2f2" }}>
                      <AlertTriangle className="h-5 w-5" style={{ color: "#f94d4d" }} />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">ยังไม่ออกเอกสาร</div>
                      <div className="text-xl font-bold" style={{ color: "#f94d4d" }} data-testid="text-missing-count">{summary.missingCount}</div>
                      <div className="text-xs text-muted-foreground" data-testid="text-missing-amount">฿{formatCurrency(summary.missingAmount)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-xl shadow-sm border" data-testid="card-cancelled-count">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-gray-100">
                      <XCircle className="h-5 w-5 text-gray-500" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">ยกเลิก</div>
                      <div className="text-xl font-bold text-gray-500" data-testid="text-cancelled-count">{summary.cancelledCount}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {Object.keys(byPlatform).length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3" data-testid="text-platform-breakdown-title">สรุปแยกตามแพลตฟอร์ม</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(byPlatform).map(([platform, pd]) => {
                    const p = PLATFORMS.find(pl => pl.value === platform);
                    const ratio = pd.total > 0 ? (pd.issued / pd.total) * 100 : 0;
                    return (
                      <Card key={platform} className="rounded-xl shadow-sm border overflow-hidden" data-testid={`card-platform-${platform}`}>
                        <div className="h-1" style={{ background: p?.hex || "#ccc" }} />
                        <CardContent className="pt-4 pb-4 space-y-3">
                          <div className="flex items-center justify-between">
                            {platformBadge(platform)}
                            <span className="text-xs text-muted-foreground">{pd.issued}/{pd.total} รายการ</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2" data-testid={`progress-platform-${platform}`}>
                            <div
                              className="h-2 rounded-full transition-all"
                              style={{ width: `${Math.min(ratio, 100)}%`, background: p?.hex || "#ccc" }}
                            />
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">ออกแล้ว: <span className="font-medium text-green-700">฿{formatCurrency(pd.issuedAmount)}</span></span>
                            {pd.missing > 0 && (
                              <span className="text-red-600 font-medium" data-testid={`text-platform-missing-${platform}`}>ขาด {pd.missing} รายการ</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {summary.missingCount === 0 ? (
              <Card className="rounded-xl shadow-sm border border-green-200 bg-green-50/50" data-testid="card-all-complete">
                <CardContent className="py-10 flex flex-col items-center gap-3">
                  <CheckCircle className="h-12 w-12 text-green-500" />
                  <h3 className="text-lg font-semibold text-green-700" data-testid="text-all-complete">ออกใบกำกับภาษีครบถ้วนแล้ว</h3>
                  <p className="text-sm text-green-600">ทุกคำสั่งซื้อในเดือนนี้ได้ออกใบกำกับภาษีเรียบร้อยแล้ว</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {selectedIds.size > 0 && (
                  <Card className="rounded-xl shadow-sm border border-cyan-200 bg-cyan-50/50" data-testid="card-batch-actions">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm" data-testid="text-selected-count">เลือกแล้ว {selectedIds.size} รายการ</span>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearSelection} data-testid="button-clear-selection">
                            ยกเลิกการเลือก
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 text-xs text-white"
                            style={{ background: "#fb9678" }}
                            onClick={handleBatchGenerate}
                            disabled={batchGenerateMutation.isPending}
                            data-testid="button-batch-generate"
                          >
                            {batchGenerateMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                            ออกใบกำกับภาษี ({selectedIds.size} รายการ)
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="rounded-xl shadow-sm border" data-testid="card-missing-orders">
                  <CardContent className="p-0">
                    <div className="px-4 py-3 border-b">
                      <h2 className="text-sm font-semibold" data-testid="text-missing-orders-title">คำสั่งซื้อที่ยังไม่ออกใบกำกับภาษี ({missingOrders.length} รายการ)</h2>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">
                              <Checkbox
                                checked={allSelected}
                                onCheckedChange={() => allSelected ? clearSelection() : selectAll()}
                                data-testid="checkbox-select-all"
                              />
                            </TableHead>
                            <TableHead className="text-xs">เลขคำสั่งซื้อ</TableHead>
                            <TableHead className="text-xs">แพลตฟอร์ม</TableHead>
                            <TableHead className="text-xs">ผู้ซื้อ</TableHead>
                            <TableHead className="text-xs text-right">ยอดรวม</TableHead>
                            <TableHead className="text-xs">สถานะ</TableHead>
                            <TableHead className="text-xs">วันที่สั่ง</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {missingOrders.map(order => (
                            <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedIds.has(order.id)}
                                  onCheckedChange={() => toggleSelect(order.id)}
                                  data-testid={`checkbox-order-${order.id}`}
                                />
                              </TableCell>
                              <TableCell className="text-sm font-medium" data-testid={`text-order-no-${order.id}`}>{order.orderNo}</TableCell>
                              <TableCell>{platformBadge(order.platform)}</TableCell>
                              <TableCell className="text-sm" data-testid={`text-buyer-${order.id}`}>{order.buyerName || "-"}</TableCell>
                              <TableCell className="text-sm text-right font-medium" data-testid={`text-amount-${order.id}`}>฿{formatCurrency(order.totalAmount)}</TableCell>
                              <TableCell>{orderStatusBadge(order.status)}</TableCell>
                              <TableCell className="text-sm text-muted-foreground" data-testid={`text-date-${order.id}`}>{formatDate(order.placedAt, dateEra, dateFmt)}</TableCell>
                            </TableRow>
                          ))}
                          {missingOrders.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground" data-testid="text-no-missing-orders">
                                ไม่พบรายการที่ต้องออกใบกำกับภาษี
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </EcommerceLayout>
  );
}
