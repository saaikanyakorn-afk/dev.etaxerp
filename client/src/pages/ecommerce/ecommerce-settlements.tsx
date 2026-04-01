import { useState, useMemo } from "react";
import EcommerceLayout from "@/components/ecommerce-layout";
import { getPlatformLogo } from "@/lib/platform-logos";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Wallet, Loader2, Plus, Trash2, ArrowDownToLine, FileSpreadsheet,
  ChevronDown, ChevronUp, FileText, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import ThaiDateInput from "@/components/thai-date-input";
import { toLocalDateStr } from "@/lib/utils";

import { useDateSettings } from "@/hooks/use-date-settings";
const PLATFORMS = [
  { value: "shopee", label: "Shopee", hex: "#EE4D2D", bgLight: "bg-orange-100", textColor: "text-orange-700" },
  { value: "lazada", label: "Lazada", hex: "#0F146D", bgLight: "bg-indigo-100", textColor: "text-indigo-700" },
  { value: "tiktok", label: "TikTok Shop", hex: "#000000", bgLight: "bg-gray-100", textColor: "text-gray-900" },
  { value: "amazon", label: "Amazon", hex: "#FF9900", bgLight: "bg-amber-100", textColor: "text-amber-700" },
];

type Settlement = {
  id: number;
  companyId: number;
  platform: string;
  settlementNo: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  settlementDate: string;
  totalSales: string;
  totalShippingFee: string;
  totalSellerDiscount: string;
  totalCommission: string;
  totalServiceFee: string;
  totalPaymentFee: string;
  totalShippingCost: string;
  totalOtherFees: string;
  totalAdjustments: string;
  netAmount: string;
  walletStatus: string;
  withdrawnDate: string | null;
  settleJournalId: number | null;
  withdrawJournalId: number | null;
  orderCount: number;
  notes: string | null;
  importSource: string;
  createdAt: string;
  reversalJournalId: number | null;
  invoiceStatus: string;
  taxInvoiceNo: string | null;
  taxInvoiceDate: string | null;
  taxInvoiceAmount: string | null;
  taxInvoiceVat: string | null;
  varianceAmount: string | null;
};

type WalletBalance = {
  platform: string;
  balance: string;
  totalSettled: string;
  totalWithdrawn: string;
  count: string;
};

type SettlementResponse = {
  settlements: Settlement[];
  walletBalances: WalletBalance[];
};

function platformInfo(platform: string) {
  return PLATFORMS.find(p => p.value === platform);
}

function platformBadge(platform: string) {
  const p = platformInfo(platform);
  if (!p) return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">{platform}</Badge>;
  return <Badge className={`${p.bgLight} ${p.textColor} hover:${p.bgLight}`}>{p.label}</Badge>;
}

function formatCurrency(v: string | number | null | undefined) {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type SettlementItem = {
  id: number;
  settlementId: number;
  orderId: number | null;
  platformOrderId: string | null;
  orderNo: string | null;
  productAmount: string;
  shippingFee: string;
  sellerDiscount: string;
  platformDiscount: string;
  commissionFee: string;
  serviceFee: string;
  paymentFee: string;
  shippingCost: string;
  otherFees: string;
  adjustments: string;
  platformShippingSubsidy: string;
  buyerRefund: string;
  sellerShippingPromo: string;
  returnShipping: string;
  withholdingTax: string;
  adsDeduction: string;
  netAmount: string;
  itemType: string;
};

function SettlementItemsTable({ settlementId }: { settlementId: number }) {
  const { data, isLoading } = useQuery<{ items: SettlementItem[] }>({
    queryKey: ["/api/ecommerce/settlement-batches", settlementId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/settlement-batches/${settlementId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const items = data?.items || [];

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (items.length === 0) return <p className="text-xs text-muted-foreground py-2">ไม่พบรายการออเดอร์</p>;

  const totalProduct = items.reduce((sum, i) => sum + Number(i.productAmount || 0), 0);
  const totalShip = items.reduce((sum, i) => sum + Number(i.shippingFee || 0), 0);
  const totalDisc = items.reduce((sum, i) => sum + Number(i.sellerDiscount || 0) + Number(i.platformDiscount || 0), 0);
  const totalComm = items.reduce((sum, i) => sum + Number(i.commissionFee || 0), 0);
  const totalSvc = items.reduce((sum, i) => sum + Number(i.serviceFee || 0), 0);
  const totalPay = items.reduce((sum, i) => sum + Number(i.paymentFee || 0), 0);
  const totalShipCost = items.reduce((sum, i) => sum + Number(i.shippingCost || 0), 0);
  const totalRefund = items.reduce((sum, i) => sum + Number(i.buyerRefund || 0), 0);
  const totalNet = items.reduce((sum, i) => sum + Number(i.netAmount || 0), 0);

  return (
    <div className="mt-3" data-testid={`settlement-items-${settlementId}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-gray-700">รายการออเดอร์ ({items.length} รายการ)</span>
      </div>
      <div className="border rounded-lg overflow-x-auto bg-white">
        <Table>
          <TableHeader>
            <TableRow className="text-[11px] bg-gray-100">
              <TableHead className="text-[11px] w-8">#</TableHead>
              <TableHead className="text-[11px]">เลขออเดอร์</TableHead>
              <TableHead className="text-[11px]">ประเภท</TableHead>
              <TableHead className="text-[11px] text-right">ยอดสินค้า</TableHead>
              <TableHead className="text-[11px] text-right">ค่าส่ง</TableHead>
              <TableHead className="text-[11px] text-right">ส่วนลด</TableHead>
              <TableHead className="text-[11px] text-right">คอมมิชชั่น</TableHead>
              <TableHead className="text-[11px] text-right">ค่าบริการ</TableHead>
              <TableHead className="text-[11px] text-right">ค่าชำระ</TableHead>
              <TableHead className="text-[11px] text-right">ค่าขนส่ง</TableHead>
              <TableHead className="text-[11px] text-right">เงินคืนผู้ซื้อ</TableHead>
              <TableHead className="text-[11px] text-right font-semibold">ยอดสุทธิ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, idx) => {
              const discount = Number(item.sellerDiscount || 0) + Number(item.platformDiscount || 0);
              return (
                <TableRow key={item.id} className="text-[11px]" data-testid={`item-row-${item.id}`}>
                  <TableCell className="text-[11px] text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="text-[11px] font-mono">{item.orderNo || item.platformOrderId || "-"}</TableCell>
                  <TableCell className="text-[11px]">
                    {item.itemType === "order" ? (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px]">ออเดอร์</Badge>
                    ) : item.itemType === "adjustment" ? (
                      <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 text-[10px]">ปรับปรุง</Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 text-[10px]">{item.itemType}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-[11px] text-right">{formatCurrency(item.productAmount)}</TableCell>
                  <TableCell className="text-[11px] text-right">{formatCurrency(item.shippingFee)}</TableCell>
                  <TableCell className="text-[11px] text-right text-orange-600">{discount !== 0 ? `-${formatCurrency(Math.abs(discount))}` : "0.00"}</TableCell>
                  <TableCell className="text-[11px] text-right text-red-600">{Number(item.commissionFee) !== 0 ? `-${formatCurrency(Math.abs(Number(item.commissionFee)))}` : "0.00"}</TableCell>
                  <TableCell className="text-[11px] text-right text-red-600">{Number(item.serviceFee) !== 0 ? `-${formatCurrency(Math.abs(Number(item.serviceFee)))}` : "0.00"}</TableCell>
                  <TableCell className="text-[11px] text-right text-red-600">{Number(item.paymentFee) !== 0 ? `-${formatCurrency(Math.abs(Number(item.paymentFee)))}` : "0.00"}</TableCell>
                  <TableCell className="text-[11px] text-right">{formatCurrency(item.shippingCost)}</TableCell>
                  <TableCell className="text-[11px] text-right text-orange-600">{Number(item.buyerRefund) !== 0 ? `-${formatCurrency(Math.abs(Number(item.buyerRefund)))}` : "0.00"}</TableCell>
                  <TableCell className="text-[11px] text-right font-semibold text-green-700">{formatCurrency(item.netAmount)}</TableCell>
                </TableRow>
              );
            })}
            <TableRow className="text-[11px] font-semibold bg-gray-50 border-t-2">
              <TableCell colSpan={3} className="text-[11px] font-semibold">รวมทั้งหมด ({items.length} รายการ)</TableCell>
              <TableCell className="text-[11px] text-right font-semibold">{formatCurrency(totalProduct)}</TableCell>
              <TableCell className="text-[11px] text-right font-semibold">{formatCurrency(totalShip)}</TableCell>
              <TableCell className="text-[11px] text-right font-semibold text-orange-600">{totalDisc !== 0 ? `-${formatCurrency(Math.abs(totalDisc))}` : "0.00"}</TableCell>
              <TableCell className="text-[11px] text-right font-semibold text-red-600">{totalComm !== 0 ? `-${formatCurrency(Math.abs(totalComm))}` : "0.00"}</TableCell>
              <TableCell className="text-[11px] text-right font-semibold text-red-600">{totalSvc !== 0 ? `-${formatCurrency(Math.abs(totalSvc))}` : "0.00"}</TableCell>
              <TableCell className="text-[11px] text-right font-semibold text-red-600">{totalPay !== 0 ? `-${formatCurrency(Math.abs(totalPay))}` : "0.00"}</TableCell>
              <TableCell className="text-[11px] text-right font-semibold">{formatCurrency(totalShipCost)}</TableCell>
              <TableCell className="text-[11px] text-right font-semibold text-orange-600">{totalRefund !== 0 ? `-${formatCurrency(Math.abs(totalRefund))}` : "0.00"}</TableCell>
              <TableCell className="text-[11px] text-right font-bold text-green-700">{formatCurrency(totalNet)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function walletStatusBadge(status: string) {
  if (status === "withdrawn") {
    return <Badge data-testid={`badge-wallet-${status}`} className="bg-green-100 text-green-700 hover:bg-green-100">ถอนแล้ว</Badge>;
  }
  return <Badge data-testid={`badge-wallet-${status}`} className="bg-amber-100 text-amber-700 hover:bg-amber-100">อยู่ใน Wallet</Badge>;
}

function invoiceStatusBadge(status: string, variance?: string | null) {
  if (status === "received") return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">ได้รับใบกำกับแล้ว</Badge>;
  if (status === "mismatch") return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">ยอดไม่ตรง ({variance ? `฿${formatCurrency(variance)}` : ''})</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">รอใบกำกับ</Badge>;
}

function totalFees(s: Settlement) {
  return Number(s.totalCommission || 0) + Number(s.totalServiceFee || 0) +
    Number(s.totalPaymentFee || 0) + Number(s.totalOtherFees || 0);
}

export default function EcommerceSettlements() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

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
  const [platformFilter, setPlatformFilter] = useState("all");
  const [walletFilter, setWalletFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [withdrawDialog, setWithdrawDialog] = useState<Settlement | null>(null);
  const [withdrawDate, setWithdrawDate] = useState(toLocalDateStr(new Date()));
  const [withdrawAccount, setWithdrawAccount] = useState("1011");
  const [withdrawNotes, setWithdrawNotes] = useState("");
  const [invoiceDialog, setInvoiceDialog] = useState<Settlement | null>(null);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(toLocalDateStr(new Date()));
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceVat, setInvoiceVat] = useState("");

  const { data, isLoading } = useQuery<SettlementResponse>({
    queryKey: ["/api/ecommerce/settlement-batches", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/settlement-batches?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const settlements = data?.settlements || [];
  const walletBalances = data?.walletBalances || [];

  const filtered = useMemo(() => {
    return settlements.filter(s => {
      if (platformFilter !== "all" && s.platform !== platformFilter) return false;
      if (walletFilter === "in_wallet" && s.walletStatus !== "in_wallet") return false;
      if (walletFilter === "withdrawn" && s.walletStatus !== "withdrawn") return false;
      return true;
    });
  }, [settlements, platformFilter, walletFilter]);

  const invoiceSummary = useMemo(() => {
    const pending = settlements.filter(s => s.invoiceStatus === "pending" && s.settleJournalId).length;
    const received = settlements.filter(s => s.invoiceStatus === "received").length;
    const mismatch = settlements.filter(s => s.invoiceStatus === "mismatch").length;
    return { pending, received, mismatch };
  }, [settlements]);

  const recordInvoiceMutation = useMutation({
    mutationFn: async ({ id, taxInvoiceNo, taxInvoiceDate, taxInvoiceAmount, taxInvoiceVat }: 
      { id: number; taxInvoiceNo: string; taxInvoiceDate: string; taxInvoiceAmount: string; taxInvoiceVat: string }) => {
      const r = await fetch(`/api/ecommerce/settlement-batches/${id}/record-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ taxInvoiceNo, taxInvoiceDate, taxInvoiceAmount: Number(taxInvoiceAmount), taxInvoiceVat: Number(taxInvoiceVat || 0) }),
      });
      if (!r.ok) throw new Error((await r.json()).message || "บันทึกไม่สำเร็จ");
      return r.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/settlement-batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/orders"] });
      setInvoiceDialog(null);
      setInvoiceNo(""); setInvoiceAmount(""); setInvoiceVat("");
      toast({ title: "บันทึกใบกำกับภาษีสำเร็จ", description: data.message });
    },
    onError: (err: Error) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const withdrawMutation = useMutation({
    mutationFn: async ({ id, date, accountCode, notes }: { id: number; date: string; accountCode: string; notes: string }) => {
      const r = await fetch(`/api/ecommerce/settlement-batches/${id}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ withdrawnDate: date, bankAccountCode: accountCode, notes }),
      });
      if (!r.ok) throw new Error((await r.json()).message || "ถอนเงินไม่สำเร็จ");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/settlement-batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      setWithdrawDialog(null);
      toast({ title: "ถอนเงินสำเร็จ", description: "บันทึกรายการถอนเงินเรียบร้อย" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/ecommerce/settlement-batches/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).message || "ลบไม่สำเร็จ");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/settlement-batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/orders"] });
      toast({ title: "ลบ Settlement สำเร็จ" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const openWithdrawDialog = (s: Settlement) => {
    setWithdrawDialog(s);
    setWithdrawDate(toLocalDateStr(new Date()));
    setWithdrawAccount("1011");
    setWithdrawNotes("");
  };

  return (
    <EcommerceLayout>
      <div className="space-y-5" data-testid="page-settlements">
        <div>
          <h1 className="text-2xl font-bold text-gray-800" data-testid="text-settlements-title">Settlement & Wallet</h1>
          <p className="text-sm text-muted-foreground mt-1">จัดการรายการ Settlement และยอดคงเหลือ Wallet ของแต่ละแพลตฟอร์ม</p>
        </div>

        {/* Wallet Balance Cards */}
        {walletBalances.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="section-wallet-balances">
            {walletBalances.map(wb => {
              const p = platformInfo(wb.platform);
              return (
                <Card key={wb.platform} className="rounded-xl shadow-sm border overflow-hidden" data-testid={`card-wallet-${wb.platform}`}>
                  <div className="h-1.5" style={{ background: p?.hex || "#ccc" }} />
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between mb-3">
                      {platformBadge(wb.platform)}
                      <span className="text-xs text-muted-foreground" data-testid={`text-wallet-count-${wb.platform}`}>{wb.count} รายการ</span>
                    </div>
                    <div className="mb-3">
                      <div className="text-xs text-muted-foreground">ยอดคงเหลือใน Wallet</div>
                      <div className="text-2xl font-bold" style={{ color: p?.hex || "#333" }} data-testid={`text-wallet-balance-${wb.platform}`}>
                        ฿{formatCurrency(wb.balance)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground">โอนเข้าแล้ว </span>
                        <span className="font-medium text-green-700" data-testid={`text-wallet-settled-${wb.platform}`}>฿{formatCurrency(wb.totalSettled)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">ถอนแล้ว </span>
                        <span className="font-medium text-blue-700" data-testid={`text-wallet-withdrawn-${wb.platform}`}>฿{formatCurrency(wb.totalWithdrawn)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Invoice Summary Cards */}
        <div className="grid grid-cols-3 gap-3" data-testid="section-invoice-summary">
          <Card className="rounded-xl shadow-sm border">
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <FileText className="h-5 w-5 text-yellow-600" />
              <div>
                <div className="text-xs text-muted-foreground">รอใบกำกับ</div>
                <div className="text-lg font-bold text-yellow-700" data-testid="text-invoice-pending">{invoiceSummary.pending}</div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm border">
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-xs text-muted-foreground">ได้รับแล้ว</div>
                <div className="text-lg font-bold text-green-700" data-testid="text-invoice-received">{invoiceSummary.received}</div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm border">
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <div className="text-xs text-muted-foreground">ยอดไม่ตรง</div>
                <div className="text-lg font-bold text-red-700" data-testid="text-invoice-mismatch">{invoiceSummary.mismatch}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons & Filters */}
        <Card className="rounded-xl shadow-sm border">
          <CardContent className="py-3 px-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() => navigate("/ecommerce/settlement-import")}
                className="bg-orange-500 hover:bg-orange-600 text-white"
                data-testid="button-import-settlement"
              >
                <Plus className="h-4 w-4 mr-1" /> นำเข้า Settlement
              </Button>
              <Button
                onClick={() => navigate("/ecommerce/withdrawal-import")}
                variant="outline"
                className="border-[#03c9d7] text-[#03c9d7] hover:bg-[#03c9d7]/10"
                data-testid="button-import-withdrawal"
              >
                <Plus className="h-4 w-4 mr-1" /> นำเข้าถอนเงิน
              </Button>

              <div className="flex items-center gap-2 ml-auto">
                <label className="text-xs text-muted-foreground whitespace-nowrap">แพลตฟอร์ม:</label>
                <Select value={platformFilter} onValueChange={setPlatformFilter}>
                  <SelectTrigger className="w-[140px] h-8 text-sm rounded-lg" data-testid="select-platform-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground whitespace-nowrap">สถานะ Wallet:</label>
                <Select value={walletFilter} onValueChange={setWalletFilter}>
                  <SelectTrigger className="w-[150px] h-8 text-sm rounded-lg" data-testid="select-wallet-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    <SelectItem value="in_wallet">อยู่ใน Wallet</SelectItem>
                    <SelectItem value="withdrawn">ถอนแล้ว</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settlement Batches Table */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="rounded-xl shadow-sm border">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm" data-testid="text-empty-state">ไม่พบรายการ Settlement</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => navigate("/ecommerce/settlement-import")}
                data-testid="button-import-empty"
              >
                <FileSpreadsheet className="h-4 w-4 mr-1" /> นำเข้า Settlement
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs bg-gray-50">
                    <TableHead className="text-xs w-12">#</TableHead>
                    <TableHead className="text-xs">Settlement No</TableHead>
                    <TableHead className="text-xs">แพลตฟอร์ม</TableHead>
                    <TableHead className="text-xs">วันที่ Settlement</TableHead>
                    <TableHead className="text-xs text-right">ยอดขาย</TableHead>
                    <TableHead className="text-xs text-right">ค่าธรรมเนียม</TableHead>
                    <TableHead className="text-xs text-right">ค่าขนส่ง</TableHead>
                    <TableHead className="text-xs text-right">ยอดสุทธิ</TableHead>
                    <TableHead className="text-xs text-center">ออเดอร์</TableHead>
                    <TableHead className="text-xs text-center">สถานะ Wallet</TableHead>
                    <TableHead className="text-xs text-center">Journal</TableHead>
                    <TableHead className="text-xs text-center">สถานะใบกำกับ</TableHead>
                    <TableHead className="text-xs text-center">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s, idx) => {
                    const isExpanded = expandedId === s.id;
                    const fees = totalFees(s);
                    return (
                      <>
                        <TableRow
                          key={s.id}
                          className="text-sm cursor-pointer hover:bg-gray-50/80"
                          onClick={() => setExpandedId(isExpanded ? null : s.id)}
                          data-testid={`row-settlement-${s.id}`}
                        >
                          <TableCell className="text-xs text-muted-foreground" data-testid={`text-row-no-${s.id}`}>{idx + 1}</TableCell>
                          <TableCell className="font-mono text-xs" data-testid={`text-settlement-no-${s.id}`}>
                            {s.settlementNo || "-"}
                          </TableCell>
                          <TableCell data-testid={`badge-platform-${s.id}`}>{platformBadge(s.platform)}</TableCell>
                          <TableCell className="text-xs" data-testid={`text-date-${s.id}`}>
                            {formatDate(s.settlementDate, dateEra, dateFmt)}
                          </TableCell>
                          <TableCell className="text-right text-xs" data-testid={`text-sales-${s.id}`}>
                            ฿{formatCurrency(s.totalSales)}
                          </TableCell>
                          <TableCell className="text-right text-xs text-red-600" data-testid={`text-fees-${s.id}`}>
                            -฿{formatCurrency(fees)}
                          </TableCell>
                          <TableCell className="text-right text-xs" data-testid={`text-shipping-${s.id}`}>
                            ฿{formatCurrency(s.totalShippingCost)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-semibold text-green-700" data-testid={`text-net-${s.id}`}>
                            ฿{formatCurrency(s.netAmount)}
                          </TableCell>
                          <TableCell className="text-center text-xs" data-testid={`text-orders-${s.id}`}>
                            {s.orderCount}
                          </TableCell>
                          <TableCell className="text-center">{walletStatusBadge(s.walletStatus)}</TableCell>
                          <TableCell className="text-center text-xs" data-testid={`text-journal-${s.id}`}>
                            {s.settleJournalId ? (
                              <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">J-{s.settleJournalId}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">{invoiceStatusBadge(s.invoiceStatus, s.varianceAmount)}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                              {s.invoiceStatus === "pending" && s.settleJournalId && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                                  onClick={() => {
                                    setInvoiceDialog(s);
                                    setInvoiceAmount(String(totalFees(s)));
                                    const vat7 = Math.round(totalFees(s) * 7 / 107 * 100) / 100;
                                    setInvoiceVat(String(vat7));
                                  }}
                                  data-testid={`button-record-invoice-${s.id}`}
                                >
                                  <FileText className="h-3 w-3 mr-1" /> บันทึกใบกำกับ
                                </Button>
                              )}
                              {s.walletStatus === "in_wallet" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs border-green-300 text-green-700 hover:bg-green-50"
                                  onClick={() => openWithdrawDialog(s)}
                                  data-testid={`button-withdraw-${s.id}`}
                                >
                                  <ArrowDownToLine className="h-3 w-3 mr-1" /> ถอนเงิน
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-500 hover:bg-red-50"
                                onClick={() => {
                                  if (confirm("ยืนยันลบ Settlement นี้?")) deleteMutation.mutate(s.id);
                                }}
                                data-testid={`button-delete-${s.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`detail-${s.id}`} data-testid={`row-detail-${s.id}`}>
                            <TableCell colSpan={13} className="bg-gray-50/50 p-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                <div>
                                  <span className="text-muted-foreground">ช่วงเวลา:</span>
                                  <div className="font-medium" data-testid={`text-period-${s.id}`}>
                                    {s.periodFrom ? formatDate(s.periodFrom, dateEra, dateFmt) : "-"} ~ {s.periodTo ? formatDate(s.periodTo, dateEra, dateFmt) : "-"}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">ค่าส่ง (ผู้ซื้อจ่าย):</span>
                                  <div className="font-medium" data-testid={`text-shipping-fee-${s.id}`}>฿{formatCurrency(s.totalShippingFee)}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">ส่วนลดผู้ขาย:</span>
                                  <div className="font-medium" data-testid={`text-discount-${s.id}`}>฿{formatCurrency(s.totalSellerDiscount)}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">ค่าคอมมิชชั่น:</span>
                                  <div className="font-medium" data-testid={`text-commission-${s.id}`}>฿{formatCurrency(s.totalCommission)}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">ค่าบริการ:</span>
                                  <div className="font-medium" data-testid={`text-service-fee-${s.id}`}>฿{formatCurrency(s.totalServiceFee)}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">ค่าชำระเงิน:</span>
                                  <div className="font-medium" data-testid={`text-payment-fee-${s.id}`}>฿{formatCurrency(s.totalPaymentFee)}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">ค่าปรับ/อื่นๆ:</span>
                                  <div className="font-medium" data-testid={`text-adjustments-${s.id}`}>฿{formatCurrency(s.totalAdjustments)}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">แหล่งนำเข้า:</span>
                                  <div className="font-medium" data-testid={`text-source-${s.id}`}>{s.importSource || "-"}</div>
                                </div>
                                {s.withdrawnDate && (
                                  <div>
                                    <span className="text-muted-foreground">วันที่ถอน:</span>
                                    <div className="font-medium" data-testid={`text-withdrawn-date-${s.id}`}>{formatDate(s.withdrawnDate, dateEra, dateFmt)}</div>
                                  </div>
                                )}
                                {s.withdrawJournalId && (
                                  <div>
                                    <span className="text-muted-foreground">Journal ถอนเงิน:</span>
                                    <div data-testid={`text-withdraw-journal-${s.id}`}>
                                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">J-{s.withdrawJournalId}</Badge>
                                    </div>
                                  </div>
                                )}
                                {s.taxInvoiceNo && (
                                  <div>
                                    <span className="text-muted-foreground">เลขที่ใบกำกับ:</span>
                                    <div className="font-medium" data-testid={`text-tax-invoice-no-${s.id}`}>{s.taxInvoiceNo}</div>
                                  </div>
                                )}
                                {s.taxInvoiceDate && (
                                  <div>
                                    <span className="text-muted-foreground">วันที่ใบกำกับ:</span>
                                    <div className="font-medium" data-testid={`text-tax-invoice-date-${s.id}`}>{formatDate(s.taxInvoiceDate, dateEra, dateFmt)}</div>
                                  </div>
                                )}
                                {s.taxInvoiceAmount && (
                                  <div>
                                    <span className="text-muted-foreground">ยอดใบกำกับ (รวม VAT):</span>
                                    <div className="font-medium" data-testid={`text-tax-invoice-amount-${s.id}`}>฿{formatCurrency(s.taxInvoiceAmount)}</div>
                                  </div>
                                )}
                                {s.varianceAmount && Math.abs(Number(s.varianceAmount)) >= 0.01 && (
                                  <div>
                                    <span className="text-muted-foreground">ผลต่าง:</span>
                                    <div className={`font-medium ${Number(s.varianceAmount) > 0 ? 'text-red-600' : 'text-green-600'}`} data-testid={`text-variance-${s.id}`}>
                                      ฿{formatCurrency(s.varianceAmount)}
                                    </div>
                                  </div>
                                )}
                                {s.reversalJournalId && (
                                  <div>
                                    <span className="text-muted-foreground">Journal ใบกำกับ:</span>
                                    <div data-testid={`text-reversal-journal-${s.id}`}>
                                      <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">J-{s.reversalJournalId}</Badge>
                                    </div>
                                  </div>
                                )}
                                {s.notes && (
                                  <div className="col-span-2">
                                    <span className="text-muted-foreground">หมายเหตุ:</span>
                                    <div className="font-medium" data-testid={`text-notes-${s.id}`}>{s.notes}</div>
                                  </div>
                                )}
                              </div>
                              <SettlementItemsTable settlementId={s.id} />
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

        {/* Withdraw Dialog */}
        <Dialog open={!!withdrawDialog} onOpenChange={open => { if (!open) setWithdrawDialog(null); }}>
          <DialogContent className="sm:max-w-md" data-testid="dialog-withdraw">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowDownToLine className="h-5 w-5 text-green-600" />
                ถอนเงินจาก Wallet
              </DialogTitle>
            </DialogHeader>
            {withdrawDialog && (
              <div className="space-y-4">
                <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Settlement:</span>
                    <span className="font-medium" data-testid="text-withdraw-settlement-no">{withdrawDialog.settlementNo || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">แพลตฟอร์ม:</span>
                    {platformBadge(withdrawDialog.platform)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">ยอดสุทธิ:</span>
                    <span className="font-bold text-green-700" data-testid="text-withdraw-amount">฿{formatCurrency(withdrawDialog.netAmount)}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-sm">วันที่ถอนเงิน</Label>
                    <ThaiDateInput
                      value={withdrawDate}
                      onChange={setWithdrawDate}
                      dateEra={dateEra}
                      dateFmt={dateFmt}
                      className="w-[160px] mt-1"
                      data-testid="input-withdraw-date"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">รหัสบัญชีธนาคาร (เดบิต)</Label>
                    <Input
                      value={withdrawAccount}
                      onChange={e => setWithdrawAccount(e.target.value)}
                      placeholder="1011"
                      className="mt-1"
                      data-testid="input-withdraw-account"
                    />
                    <p className="text-xs text-muted-foreground mt-1">1011000 = เงินฝากออมทรัพย์</p>
                  </div>
                  <div>
                    <Label className="text-sm">หมายเหตุ</Label>
                    <Textarea
                      value={withdrawNotes}
                      onChange={e => setWithdrawNotes(e.target.value)}
                      placeholder="หมายเหตุเพิ่มเติม (ไม่บังคับ)"
                      className="mt-1"
                      rows={2}
                      data-testid="input-withdraw-notes"
                    />
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setWithdrawDialog(null)} data-testid="button-withdraw-cancel">
                ยกเลิก
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={withdrawMutation.isPending || !withdrawDate}
                onClick={() => {
                  if (!withdrawDialog) return;
                  withdrawMutation.mutate({
                    id: withdrawDialog.id,
                    date: withdrawDate,
                    accountCode: withdrawAccount,
                    notes: withdrawNotes,
                  });
                }}
                data-testid="button-withdraw-confirm"
              >
                {withdrawMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                ยืนยันถอนเงิน
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Invoice Recording Dialog */}
        <Dialog open={!!invoiceDialog} onOpenChange={open => { if (!open) setInvoiceDialog(null); }}>
          <DialogContent className="sm:max-w-lg" data-testid="dialog-record-invoice">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                บันทึกใบกำกับภาษีค่าธรรมเนียม
              </DialogTitle>
            </DialogHeader>
            {invoiceDialog && (
              <div className="space-y-4">
                <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Settlement:</span>
                    <span className="font-medium" data-testid="text-invoice-settlement-no">{invoiceDialog.settlementNo || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">แพลตฟอร์ม:</span>
                    {platformBadge(invoiceDialog.platform)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">ค่าธรรมเนียมจาก Settlement:</span>
                    <span className="font-bold text-red-600" data-testid="text-invoice-fees">฿{formatCurrency(totalFees(invoiceDialog))}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-sm">เลขที่ใบกำกับภาษี</Label>
                    <Input
                      value={invoiceNo}
                      onChange={e => setInvoiceNo(e.target.value)}
                      placeholder="เลขที่ใบกำกับภาษี"
                      className="mt-1"
                      data-testid="input-invoice-no"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">วันที่ใบกำกับภาษี</Label>
                    <ThaiDateInput
                      value={invoiceDate}
                      onChange={setInvoiceDate}
                      dateEra={dateEra}
                      dateFmt={dateFmt}
                      className="w-[160px] mt-1"
                      data-testid="input-invoice-date"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm">ยอดเงิน (รวม VAT)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={invoiceAmount}
                        onChange={e => setInvoiceAmount(e.target.value)}
                        className="mt-1"
                        data-testid="input-invoice-amount"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">VAT</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={invoiceVat}
                        onChange={e => setInvoiceVat(e.target.value)}
                        className="mt-1"
                        data-testid="input-invoice-vat"
                      />
                    </div>
                  </div>
                  {invoiceAmount && (
                    <div className="p-3 bg-blue-50 rounded-lg text-sm space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">ยอดก่อน VAT:</span>
                        <span className="font-medium">฿{formatCurrency(Number(invoiceAmount) - Number(invoiceVat || 0))}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">ค่าธรรมเนียมจาก Settlement:</span>
                        <span className="font-medium">฿{formatCurrency(totalFees(invoiceDialog))}</span>
                      </div>
                      {(() => {
                        const diff = Math.round((Number(invoiceAmount) - totalFees(invoiceDialog)) * 100) / 100;
                        if (Math.abs(diff) < 0.01) return (
                          <div className="flex items-center justify-between text-green-700 font-medium">
                            <span>ผลต่าง:</span>
                            <span>฿0.00 ✓ ตรงกัน</span>
                          </div>
                        );
                        return (
                          <div className="flex items-center justify-between text-red-600 font-medium">
                            <span>ผลต่าง:</span>
                            <span>฿{formatCurrency(diff)} (จะลงปรับปรุงอัตโนมัติ)</span>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setInvoiceDialog(null)} data-testid="button-invoice-cancel">
                ยกเลิก
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={recordInvoiceMutation.isPending || !invoiceNo || !invoiceDate || !invoiceAmount}
                onClick={() => {
                  if (!invoiceDialog) return;
                  recordInvoiceMutation.mutate({
                    id: invoiceDialog.id,
                    taxInvoiceNo: invoiceNo,
                    taxInvoiceDate: invoiceDate,
                    taxInvoiceAmount: invoiceAmount,
                    taxInvoiceVat: invoiceVat || "0",
                  });
                }}
                data-testid="button-invoice-confirm"
              >
                {recordInvoiceMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                บันทึกใบกำกับภาษี
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </EcommerceLayout>
  );
}
