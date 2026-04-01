import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/lib/company-context";
import { EtaxSendDialog } from "@/components/etax-send-dialog";
import {
  Mail, Send, FileText, Search, Calendar, Users, DollarSign, Hash,
  ArrowLeft, ExternalLink, Loader2, RefreshCw
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { useDateSettings } from "@/hooks/use-date-settings";
import ThaiDateInput from "@/components/thai-date-input";

function pad2(n: number) { return String(n).padStart(2, "0"); }
function toLocalDateStr(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function getMonthRange(offset: number = 0) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offset;
  const from = new Date(y, m, 1);
  const to = new Date(y, m + 1, 0);
  return {
    fromDate: toLocalDateStr(from),
    toDate: toLocalDateStr(to),
    label: from.toLocaleDateString("th-TH", { month: "long", year: "numeric" }),
  };
}

export default function EtaxSentList() {
  const [, navigate] = useLocation();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { dateEra, dateFmt } = useDateSettings();

  const [monthOffset, setMonthOffset] = useState(0);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [resendDialog, setResendDialog] = useState<{ open: boolean; id: number; no: string; sentTo?: string }>({ open: false, id: 0, no: "" });

  const monthRange = getMonthRange(monthOffset);
  const fromDate = useCustomRange ? customFrom : monthRange.fromDate;
  const toDate = useCustomRange ? customTo : monthRange.toDate;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/etax/sent-list", companyId, fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      const res = await fetch(`/api/etax/sent-list?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!companyId,
  });

  const rows = data?.rows || [];
  const summary = data?.summary || { totalSent: 0, totalAmount: "0.00", totalVat: "0.00", uniqueRecipients: 0 };

  const filtered = searchText
    ? rows.filter((r: any) =>
        (r.taxInvoiceNo || "").toLowerCase().includes(searchText.toLowerCase()) ||
        (r.customerName || "").toLowerCase().includes(searchText.toLowerCase()) ||
        (r.etaxSentTo || "").toLowerCase().includes(searchText.toLowerCase())
      )
    : rows;

  const displayLabel = useCustomRange
    ? `${customFrom || "..."} ถึง ${customTo || "..."}`
    : monthRange.label;

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/sales/tax-invoice")} data-testid="btn-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2" data-testid="text-page-title">
              <Mail className="h-5 w-5" style={{ color: "var(--theme-primary)" }} />
              รายการส่ง e-Tax Invoice
            </h1>
            <p className="text-sm text-gray-500">ประวัติการส่ง e-Tax Invoice by Email ตามมาตรฐาน สพธอ.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-l-4 border-l-[#fb9678]" data-testid="card-total-sent">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">จำนวนใบที่ส่ง</p>
                  <p className="text-2xl font-bold text-gray-800">{summary.totalSent}</p>
                </div>
                <div className="p-2 bg-orange-50 rounded-lg">
                  <Hash className="h-5 w-5 text-[#fb9678]" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-[#05b187]" data-testid="card-total-amount">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">ยอดรวมทั้งหมด</p>
                  <p className="text-2xl font-bold text-gray-800">฿{parseFloat(summary.totalAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="p-2 bg-green-50 rounded-lg">
                  <DollarSign className="h-5 w-5 text-[#05b187]" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-[#fec90f]" data-testid="card-total-vat">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">ภาษีมูลค่าเพิ่ม</p>
                  <p className="text-2xl font-bold text-gray-800">฿{parseFloat(summary.totalVat).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="p-2 bg-yellow-50 rounded-lg">
                  <FileText className="h-5 w-5 text-[#fec90f]" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-[#03c9d7]" data-testid="card-recipients">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">ผู้รับ (ไม่ซ้ำ)</p>
                  <p className="text-2xl font-bold text-gray-800">{summary.uniqueRecipients}</p>
                </div>
                <div className="p-2 bg-cyan-50 rounded-lg">
                  <Users className="h-5 w-5 text-[#03c9d7]" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => { setUseCustomRange(false); setMonthOffset(prev => prev - 1); }}
                  data-testid="btn-prev-month"
                >
                  &lt;
                </Button>
                <Button
                  variant={!useCustomRange ? "default" : "outline"}
                  size="sm"
                  className={`h-8 min-w-[140px]`}
                  style={!useCustomRange ? { background: "var(--theme-primary)" } : undefined}
                  onClick={() => { setUseCustomRange(false); setMonthOffset(0); }}
                  data-testid="btn-current-month"
                >
                  <Calendar className="h-3.5 w-3.5 mr-1" />
                  {useCustomRange ? "เดือนปัจจุบัน" : displayLabel}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => { setUseCustomRange(false); setMonthOffset(prev => prev + 1); }}
                  disabled={monthOffset >= 0 && !useCustomRange}
                  data-testid="btn-next-month"
                >
                  &gt;
                </Button>
              </div>

              <div className="flex items-center gap-1 text-sm text-gray-500">
                <span>หรือ</span>
                <ThaiDateInput
                  value={customFrom}
                  onChange={(v: string) => { setCustomFrom(v); setUseCustomRange(true); }}
                  dateEra={dateEra} dateFmt={dateFmt}
                  className="h-8 w-[150px]"
                  data-testid="input-from-date"
                />
                <span>ถึง</span>
                <ThaiDateInput
                  value={customTo}
                  onChange={(v: string) => { setCustomTo(v); setUseCustomRange(true); }}
                  dateEra={dateEra} dateFmt={dateFmt}
                  className="h-8 w-[150px]"
                  data-testid="input-to-date"
                />
              </div>

              <div className="flex-1" />

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="ค้นหาเลขที่/ลูกค้า/อีเมล..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="h-8 pl-8 w-60"
                  data-testid="input-search"
                />
              </div>

              <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => refetch()} data-testid="btn-refresh">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <Mail className="h-10 w-10 mb-2" />
                <p className="text-sm">ไม่พบรายการส่ง e-Tax Invoice ในช่วงเวลานี้</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[var(--theme-primary)] hover:bg-[var(--theme-primary)]">
                      <TableHead className="w-10 text-center text-white">#</TableHead>
                      <TableHead className="text-white">เลขที่เอกสาร</TableHead>
                      <TableHead className="text-white">วันที่ใบกำกับภาษี</TableHead>
                      <TableHead className="text-white">ลูกค้า</TableHead>
                      <TableHead className="text-white">ส่งถึง</TableHead>
                      <TableHead className="text-right text-white">จำนวนเงิน</TableHead>
                      <TableHead className="text-white">วันที่ส่ง</TableHead>
                      <TableHead className="text-center text-white">ประเภท</TableHead>
                      <TableHead className="text-center w-20 text-white">ดำเนินการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row: any, idx: number) => (
                      <TableRow key={row.id} className="hover:bg-gray-50/50" data-testid={`row-etax-${row.id}`}>
                        <TableCell className="text-center text-sm text-gray-400">{idx + 1}</TableCell>
                        <TableCell>
                          <button
                            className="text-sm font-semibold hover:underline"
                            style={{ color: "var(--theme-primary)" }}
                            onClick={() => navigate(`/sales/tax-invoice/edit/${row.id}`)}
                            data-testid={`link-tiv-${row.id}`}
                          >
                            {row.taxInvoiceNo}
                          </button>
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(row.taxInvoiceDate, dateEra, dateFmt)}</TableCell>
                        <TableCell className="text-sm font-medium text-gray-800 max-w-[200px] truncate">{row.customerName}</TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600 flex items-center gap-1">
                            <Mail className="h-3 w-3 text-gray-400" />
                            {row.etaxSentTo}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          ฿{parseFloat(String(row.totalAmount || "0")).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {row.etaxSentAt ? new Date(row.etaxSentAt).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.isCreditNote ? (
                            <Badge variant="outline" className="text-xs border-amber-300 text-amber-600">ใบลดหนี้</Badge>
                          ) : row.isDebitNote ? (
                            <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">ใบเพิ่มหนี้</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs border-blue-300 text-blue-600">ใบกำกับภาษี</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            onClick={() => setResendDialog({ open: true, id: row.id, no: row.taxInvoiceNo, sentTo: row.etaxSentTo })}
                            data-testid={`btn-resend-${row.id}`}
                          >
                            <Send className="h-3.5 w-3.5 mr-1" />
                            ส่งซ้ำ
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {filtered.length > 0 && (
              <div className="px-4 py-2 border-t text-sm text-gray-500 flex justify-between">
                <span>แสดง {filtered.length} รายการ</span>
                <span>ยอดรวม: ฿{filtered.reduce((s: number, r: any) => s + parseFloat(String(r.totalAmount || "0")), 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <EtaxSendDialog
        open={resendDialog.open}
        onOpenChange={(open) => setResendDialog(prev => ({ ...prev, open }))}
        taxInvoiceId={resendDialog.id}
        taxInvoiceNo={resendDialog.no}
        isResend={true}
        existingSentTo={resendDialog.sentTo}
      />
    </Layout>
  );
}
