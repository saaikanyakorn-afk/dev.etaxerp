import EcommerceLayout from "@/components/ecommerce-layout";
import { getPlatformLogo } from "@/lib/platform-logos";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileDown, BarChart3, Package, RefreshCw, DollarSign, PackageCheck, Wrench, Trash2, Clock, ArrowLeft, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useLocation } from "wouter";
import { useMemo } from "react";

const PLATFORMS: Record<string, { label: string; bg: string; text: string }> = {
  shopee: { label: "Shopee", bg: "bg-orange-100", text: "text-orange-700" },
  lazada: { label: "Lazada", bg: "bg-indigo-100", text: "text-indigo-700" },
  tiktok: { label: "TikTok Shop", bg: "bg-gray-100", text: "text-gray-900" },
  amazon: { label: "Amazon", bg: "bg-amber-100", text: "text-amber-700" },
  live: { label: "Live Selling", bg: "bg-pink-100", text: "text-pink-700" },
};

function fmt(v: number) {
  return v.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtInt(v: number) {
  return v.toLocaleString("th-TH");
}

function platformLabel(p: string) {
  return PLATFORMS[p]?.label || p;
}

function platformBadge(p: string) {
  const pl = PLATFORMS[p];
  if (!pl) return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">{p}</Badge>;
  const logo = getPlatformLogo(p);
  return (
    <Badge className={`${pl.bg} ${pl.text} hover:${pl.bg} gap-1`}>
      {logo && <img src={logo} alt={pl.label} className="w-4 h-4 rounded-full object-cover" />}
      {pl.label}
    </Badge>
  );
}

type ReportData = {
  totalReturns: number;
  totalRefund: number;
  completedRefunds: number;
  totalItems: number;
  totalLoss: number;
  dispositionSummary: { restock: number; repair: number; writeoff: number; pending: number };
  byPlatform: Record<string, { count: number; refund: number; items: number }>;
  byReason: Record<string, { count: number; refund: number }>;
  topProducts: { productName: string; sku: string | null; count: number; qty: number; refund: number; restock: number; writeoff: number }[];
  qcSummary: { pending: number; completed: number; normal: number; minor_damage: number; major_damage: number; unsellable: number };
  zoneSummary: Record<string, number>;
};

export default function EcommerceReturnsReport() {
  const { selectedCompanyId } = useCompany();
  const [, navigate] = useLocation();

  const { data: report, isLoading } = useQuery<ReportData>({
    queryKey: ["/api/ecommerce/returns/report", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/returns/report?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const platformEntries = useMemo(() => {
    if (!report?.byPlatform) return [];
    return Object.entries(report.byPlatform).sort((a, b) => b[1].count - a[1].count);
  }, [report]);

  const reasonEntries = useMemo(() => {
    if (!report?.byReason) return [];
    return Object.entries(report.byReason).sort((a, b) => b[1].count - a[1].count);
  }, [report]);

  const maxPlatformCount = useMemo(() => Math.max(1, ...platformEntries.map(([, v]) => v.count)), [platformEntries]);
  const maxReasonCount = useMemo(() => Math.max(1, ...reasonEntries.map(([, v]) => v.count)), [reasonEntries]);

  function handleExcel() {
    if (!report) return;
    const wb = XLSX.utils.book_new();

    const summaryRows = [
      { "รายการ": "จำนวนคืนทั้งหมด", "ค่า": report.totalReturns },
      { "รายการ": "ยอดคืนเงินรวม", "ค่า": report.totalRefund },
      { "รายการ": "คืนเงินแล้ว", "ค่า": report.completedRefunds },
      { "รายการ": "จำนวนสินค้าทั้งหมด", "ค่า": report.totalItems },
      { "รายการ": "คืนสต็อก (ชิ้น)", "ค่า": report.dispositionSummary.restock },
      { "รายการ": "ส่งซ่อม (ชิ้น)", "ค่า": report.dispositionSummary.repair },
      { "รายการ": "ตัดจำหน่าย (ชิ้น)", "ค่า": report.dispositionSummary.writeoff },
      { "รายการ": "รอดำเนินการ (ชิ้น)", "ค่า": report.dispositionSummary.pending },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "สรุป");

    const platformRows = platformEntries.map(([k, v]) => ({
      "แพลตฟอร์ม": platformLabel(k), "จำนวนรายการ": v.count, "จำนวนสินค้า": v.items, "ยอดคืนเงิน": v.refund,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(platformRows), "แยกแพลตฟอร์ม");

    const reasonRows = reasonEntries.map(([k, v]) => ({
      "เหตุผล": k, "จำนวนรายการ": v.count, "ยอดคืนเงิน": v.refund,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reasonRows), "แยกเหตุผล");

    const productRows = report.topProducts.map(p => ({
      "สินค้า": p.productName, "SKU": p.sku || "-", "จำนวนครั้ง": p.count, "จำนวนชิ้น": p.qty,
      "ยอดคืนเงิน": p.refund, "คืนสต็อก": p.restock, "ตัดจำหน่าย": p.writeoff,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productRows), "สินค้าที่ถูกคืน");

    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    XLSX.writeFile(wb, `รายงานคืนสินค้า_${dateStr}.xlsx`);
  }

  if (isLoading) {
    return (
      <EcommerceLayout>
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </EcommerceLayout>
    );
  }

  const d = report || { totalReturns: 0, totalRefund: 0, completedRefunds: 0, totalItems: 0, totalLoss: 0, dispositionSummary: { restock: 0, repair: 0, writeoff: 0, pending: 0 }, byPlatform: {}, byReason: {}, topProducts: [], qcSummary: { pending: 0, completed: 0, normal: 0, minor_damage: 0, major_damage: 0, unsellable: 0 }, zoneSummary: {} };
  const disp = d.dispositionSummary;
  const totalDisp = disp.restock + disp.repair + disp.writeoff;

  return (
    <EcommerceLayout>
      <div className="space-y-4" data-testid="page-returns-report">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6" style={{ color: "#fb9678" }} />
              <h1 className="text-2xl font-bold text-gray-800" data-testid="text-report-title">รายงานสินค้าที่รับคืน</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">สรุปภาพรวมการคืนสินค้า แยกตามแพลตฟอร์ม เหตุผล และการจัดการ</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => navigate("/ecommerce/returns")} data-testid="button-back-returns">
              <ArrowLeft className="h-3.5 w-3.5" />คืนสินค้า
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1.5 text-white" style={{ background: "#03c9d7" }} onClick={handleExcel} disabled={!report} data-testid="button-excel">
              <FileDown className="h-3.5 w-3.5" />Excel
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="rounded-xl shadow-sm border" data-testid="card-total-returns">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-blue-50">
                  <RefreshCw className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">รายการคืนทั้งหมด</div>
                  <div className="text-xl font-bold text-blue-600">{fmtInt(d.totalReturns)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm border" data-testid="card-total-refund">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "#fff3ef" }}>
                  <DollarSign className="h-5 w-5" style={{ color: "#fb9678" }} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">ยอดคืนเงินรวม</div>
                  <div className="text-xl font-bold" style={{ color: "#fb9678" }}>฿{fmt(d.totalRefund)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm border" data-testid="card-total-items">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-amber-50">
                  <Package className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">จำนวนสินค้าคืน</div>
                  <div className="text-xl font-bold text-amber-600">{fmtInt(d.totalItems)} ชิ้น</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm border" data-testid="card-completed">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-green-50">
                  <PackageCheck className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">คืนเงินเสร็จสิ้น</div>
                  <div className="text-xl font-bold text-green-600">{fmtInt(d.completedRefunds)} / {fmtInt(d.totalReturns)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card className="rounded-xl shadow-sm border" data-testid="card-restock">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2">
                <PackageCheck className="h-4 w-4 text-green-600" />
                <div className="text-xs text-muted-foreground">คืนสต็อก</div>
                <div className="ml-auto text-lg font-bold text-green-600">{fmtInt(disp.restock)} <span className="text-xs font-normal">ชิ้น</span></div>
              </div>
              {totalDisp > 0 && (
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${(disp.restock / totalDisp) * 100}%` }} />
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm border" data-testid="card-repair">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-blue-600" />
                <div className="text-xs text-muted-foreground">ส่งซ่อม</div>
                <div className="ml-auto text-lg font-bold text-blue-600">{fmtInt(disp.repair)} <span className="text-xs font-normal">ชิ้น</span></div>
              </div>
              {totalDisp > 0 && (
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(disp.repair / totalDisp) * 100}%` }} />
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm border" data-testid="card-writeoff">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-red-600" />
                <div className="text-xs text-muted-foreground">ตัดจำหน่าย</div>
                <div className="ml-auto text-lg font-bold text-red-600">{fmtInt(disp.writeoff)} <span className="text-xs font-normal">ชิ้น</span></div>
              </div>
              {totalDisp > 0 && (
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${(disp.writeoff / totalDisp) * 100}%` }} />
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm border" data-testid="card-pending-disp">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                <div className="text-xs text-muted-foreground">รอดำเนินการ</div>
                <div className="ml-auto text-lg font-bold text-amber-600">{fmtInt(disp.pending)} <span className="text-xs font-normal">ชิ้น</span></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="rounded-xl shadow-sm border" data-testid="card-qc-summary">
            <CardContent className="pt-4">
              <div className="text-sm font-semibold text-gray-700 mb-3">สรุปผล QC</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-green-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-green-600">{fmtInt(d.qcSummary.normal)}</div>
                  <div className="text-[10px] text-green-600">ปกติ</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-yellow-600">{fmtInt(d.qcSummary.minor_damage)}</div>
                  <div className="text-[10px] text-yellow-600">ชำรุดเล็กน้อย</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-orange-600">{fmtInt(d.qcSummary.major_damage)}</div>
                  <div className="text-[10px] text-orange-600">ชำรุดมาก</div>
                </div>
                <div className="bg-red-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-red-600">{fmtInt(d.qcSummary.unsellable)}</div>
                  <div className="text-[10px] text-red-600">ขายต่อไม่ได้</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground text-center">
                QC แล้ว {fmtInt(d.qcSummary.completed)} | รอ QC {fmtInt(d.qcSummary.pending)} รายการ
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm border" data-testid="card-loss-tracking">
            <CardContent className="pt-4">
              <div className="text-sm font-semibold text-gray-700 mb-3">มูลค่าสูญเสีย & โซนสินค้า</div>
              <div className="bg-red-50 rounded-lg p-3 mb-3">
                <div className="text-xs text-red-600">มูลค่าสูญเสียรวม (ส่งซ่อม + ตัดจำหน่าย)</div>
                <div className="text-2xl font-bold text-red-600">฿{fmt(d.totalLoss)}</div>
              </div>
              <div className="space-y-1.5">
                {Object.entries(d.zoneSummary).map(([zone, count]) => {
                  const zoneLabels: Record<string, { label: string; color: string }> = {
                    receiving: { label: "โซนรับคืน", color: "bg-blue-500" },
                    qc: { label: "โซน QC", color: "bg-yellow-500" },
                    ready_for_sale: { label: "พร้อมขาย", color: "bg-green-500" },
                    damaged: { label: "โซนชำรุด", color: "bg-red-500" },
                  };
                  const totalZ = Object.values(d.zoneSummary).reduce((s: number, v) => s + (v as number), 0);
                  const info = zoneLabels[zone] || { label: zone, color: "bg-gray-500" };
                  return (
                    <div key={zone} className="flex items-center gap-2 text-xs">
                      <div className={`w-2 h-2 rounded-full ${info.color}`} />
                      <span className="w-20">{info.label}</span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${info.color}`} style={{ width: `${totalZ > 0 ? ((count as number) / totalZ) * 100 : 0}%` }} />
                      </div>
                      <span className="font-medium w-8 text-right">{count as number}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="rounded-xl shadow-sm border">
            <CardContent className="pt-4">
              <div className="text-sm font-semibold text-gray-700 mb-3">แยกตามแพลตฟอร์ม</div>
              {platformEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">ไม่มีข้อมูล</p>
              ) : (
                <div className="space-y-3">
                  {platformEntries.map(([platform, data]) => (
                    <div key={platform} data-testid={`platform-row-${platform}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {platformBadge(platform)}
                          <span className="text-xs text-muted-foreground">{data.count} รายการ · {data.items} ชิ้น</span>
                        </div>
                        <span className="text-xs font-medium" style={{ color: "#fb9678" }}>฿{fmt(data.refund)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(data.count / maxPlatformCount) * 100}%`, background: "#fb9678" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-sm border">
            <CardContent className="pt-4">
              <div className="text-sm font-semibold text-gray-700 mb-3">แยกตามเหตุผลการคืน</div>
              {reasonEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">ไม่มีข้อมูล</p>
              ) : (
                <div className="space-y-3">
                  {reasonEntries.map(([reason, data]) => (
                    <div key={reason} data-testid={`reason-row-${reason}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700">{reason}</span>
                        <span className="text-xs text-muted-foreground">{data.count} รายการ · ฿{fmt(data.refund)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(data.count / maxReasonCount) * 100}%`, background: "#03c9d7" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-xl shadow-sm border">
          <CardContent className="pt-4">
            <div className="text-sm font-semibold text-gray-700 mb-3">สินค้าที่ถูกคืนบ่อย</div>
            {d.topProducts.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">ไม่มีข้อมูล</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="text-xs">#</TableHead>
                      <TableHead className="text-xs">สินค้า</TableHead>
                      <TableHead className="text-xs">SKU</TableHead>
                      <TableHead className="text-xs text-center">จำนวนครั้ง</TableHead>
                      <TableHead className="text-xs text-center">จำนวนชิ้น</TableHead>
                      <TableHead className="text-xs text-right">ยอดคืนเงิน</TableHead>
                      <TableHead className="text-xs text-center">คืนสต็อก</TableHead>
                      <TableHead className="text-xs text-center">ตัดจำหน่าย</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.topProducts.map((p, idx) => (
                      <TableRow key={idx} className="text-sm" data-testid={`row-product-${idx}`}>
                        <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="text-xs font-medium">{p.productName}</TableCell>
                        <TableCell className="text-xs font-mono text-gray-500">{p.sku || "-"}</TableCell>
                        <TableCell className="text-xs text-center">{p.count}</TableCell>
                        <TableCell className="text-xs text-center font-medium">{p.qty}</TableCell>
                        <TableCell className="text-xs text-right font-medium" style={{ color: "#fb9678" }}>฿{fmt(p.refund)}</TableCell>
                        <TableCell className="text-xs text-center text-green-600 font-medium">{p.restock > 0 ? p.restock : "-"}</TableCell>
                        <TableCell className="text-xs text-center text-red-600 font-medium">{p.writeoff > 0 ? p.writeoff : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </EcommerceLayout>
  );
}
