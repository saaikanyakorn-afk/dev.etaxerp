import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import FoodDeliveryLayout from "@/components/food-delivery-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/lib/company-context";
import { formatDate } from "@/lib/format";
import { useDateSettings } from "@/hooks/use-date-settings";
import {
  Search, FileText, FileSpreadsheet, Download, Eye, Printer,
  Calculator, Receipt, UtensilsCrossed, ArrowRight, TrendingUp,
  CheckCircle2, Clock, AlertCircle, Upload,
} from "lucide-react";

function formatCurrency(v: number | string) {
  const num = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(num)) return "0.00";
  return num.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const isFoodPlatformRef = (refDoc: string) => {
  const ref = (refDoc || "").toUpperCase().replace(/[_\s]/g, "");
  return ref.includes("GRABFOOD") || ref.includes("GRAB#") || ref.startsWith("GR ") || ref.startsWith("GR#") ||
         ref.includes("LINEMAN") || ref.startsWith("LM ") || ref.startsWith("LM#") ||
         ref.includes("SHOPEEFOOD") || ref.startsWith("SF ") || ref.startsWith("SF#") ||
         ref.includes("ROBINHOOD") || ref.startsWith("RH ") || ref.startsWith("RH#");
};

export default function FoodAccounting() {
  const [, navigate] = useLocation();
  const { selectedCompanyId } = useCompany();
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [docTypeFilter, setDocTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

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
  const { data: taxInvoices = [] } = useQuery<any[]>({
    queryKey: ["/api/tax-invoices", selectedCompanyId, "food"],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      const res = await fetch(`/api/tax-invoices?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!res.ok) return [];
      const all = await res.json();
      return all.filter((doc: any) => isFoodPlatformRef(doc.refDoc));
    },
    enabled: !!selectedCompanyId,
  });

  const { data: invoices = [] } = useQuery<any[]>({
    queryKey: ["/api/invoices", selectedCompanyId, "food"],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      const res = await fetch(`/api/invoices?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!res.ok) return [];
      const all = await res.json();
      return all.filter((doc: any) => isFoodPlatformRef(doc.refDoc));
    },
    enabled: !!selectedCompanyId,
  });

  const allDocs = [
    ...taxInvoices.map((d: any) => ({ ...d, docType: "tax_invoice", docNo: d.taxInvoiceNo, docDate: d.taxInvoiceDate })),
    ...invoices.map((d: any) => ({ ...d, docType: "invoice", docNo: d.invoiceNo, docDate: d.invoiceDate })),
  ].sort((a, b) => new Date(b.docDate || "").getTime() - new Date(a.docDate || "").getTime());

  const filteredDocs = allDocs.filter(doc => {
    if (search) {
      const s = search.toLowerCase();
      if (!(doc.docNo || "").toLowerCase().includes(s) &&
          !(doc.customerName || "").toLowerCase().includes(s) &&
          !(doc.refDoc || "").toLowerCase().includes(s)) return false;
    }
    if (platformFilter !== "all") {
      const ref = (doc.refDoc || "").toUpperCase().replace(/[_\s]/g, "");
      if (!ref.includes(platformFilter.toUpperCase())) return false;
    }
    if (docTypeFilter !== "all" && doc.docType !== docTypeFilter) return false;
    if (statusFilter !== "all" && doc.status !== statusFilter) return false;
    return true;
  });

  const totalAmount = filteredDocs.reduce((sum, d) => sum + (parseFloat(d.totalAmount) || 0), 0);
  const totalVat = filteredDocs.reduce((sum, d) => sum + (parseFloat(d.vatAmount) || 0), 0);
  const approvedCount = filteredDocs.filter(d => d.status === "approved").length;
  const pendingCount = filteredDocs.filter(d => d.status === "draft" || d.status === "pending").length;

  const getPlatformFromRef = (refDoc: string) => {
    const ref = (refDoc || "").toUpperCase().replace(/[_\s]/g, "");
    if (ref.includes("GRAB") || ref.startsWith("GR")) return { label: "Grab Food", color: "bg-green-100 text-green-700" };
    if (ref.includes("LINE") || ref.startsWith("LM")) return { label: "LINE MAN", color: "bg-emerald-100 text-emerald-700" };
    if (ref.includes("SHOPEE") || ref.startsWith("SF")) return { label: "Shopee Food", color: "bg-orange-100 text-orange-700" };
    if (ref.includes("ROBINHOOD") || ref.startsWith("RH")) return { label: "Robinhood", color: "bg-purple-100 text-purple-700" };
    return { label: "Food", color: "bg-gray-100 text-gray-700" };
  };

  return (
    <FoodDeliveryLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">บัญชี & ใบกำกับภาษี</h1>
            <p className="text-sm text-gray-500">เอกสารทางบัญชีจากออเดอร์อาหาร Grab Food, LINE MAN, Shopee Food, Robinhood</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/food-delivery/import")}
              className="border-[#05b187] text-[#05b187] hover:bg-[#05b187]/5"
              data-testid="btn-import"
            >
              <Upload className="h-4 w-4 mr-1.5" />นำเข้า Excel
            </Button>
            <Button
              size="sm"
              style={{ background: "#05b187" }}
              className="text-white hover:opacity-90"
              onClick={() => navigate("/tax-invoices")}
              data-testid="btn-all-tiv"
            >
              <FileText className="h-4 w-4 mr-1.5" />ดูใบกำกับภาษีทั้งหมด
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="flexy-card">
            <CardContent className="p-4 text-center">
              <Receipt className="h-5 w-5 mx-auto mb-1 text-[#05b187]" />
              <div className="text-2xl font-bold text-gray-800">{filteredDocs.length}</div>
              <div className="text-xs text-gray-500">เอกสารทั้งหมด</div>
            </CardContent>
          </Card>
          <Card className="flexy-card">
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-5 w-5 mx-auto mb-1 text-[var(--theme-primary)]" />
              <div className="text-lg font-bold text-gray-800">฿{formatCurrency(totalAmount)}</div>
              <div className="text-xs text-gray-500">ยอดรวมทั้งหมด</div>
            </CardContent>
          </Card>
          <Card className="flexy-card">
            <CardContent className="p-4 text-center">
              <Calculator className="h-5 w-5 mx-auto mb-1 text-[#fec90f]" />
              <div className="text-lg font-bold text-gray-800">฿{formatCurrency(totalVat)}</div>
              <div className="text-xs text-gray-500">ภาษีมูลค่าเพิ่ม</div>
            </CardContent>
          </Card>
          <Card className="flexy-card">
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-[#05b187]" />
              <div className="text-lg font-bold text-gray-800">{approvedCount} <span className="text-sm font-normal text-amber-500">/ {pendingCount} รอ</span></div>
              <div className="text-xs text-gray-500">อนุมัติ / รออนุมัติ</div>
            </CardContent>
          </Card>
        </div>

        <Card className="flexy-card">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="ค้นหาเลขเอกสาร, ชื่อลูกค้า, อ้างอิงออเดอร์..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="w-40" data-testid="select-platform">
                  <SelectValue placeholder="แพลตฟอร์ม" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกแพลตฟอร์ม</SelectItem>
                  <SelectItem value="grab">Grab Food</SelectItem>
                  <SelectItem value="line">LINE MAN</SelectItem>
                  <SelectItem value="shopee">Shopee Food</SelectItem>
                  <SelectItem value="robinhood">Robinhood</SelectItem>
                </SelectContent>
              </Select>
              <Select value={docTypeFilter} onValueChange={setDocTypeFilter}>
                <SelectTrigger className="w-36" data-testid="select-doc-type">
                  <SelectValue placeholder="ประเภท" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกประเภท</SelectItem>
                  <SelectItem value="tax_invoice">ใบกำกับภาษี</SelectItem>
                  <SelectItem value="invoice">ใบแจ้งหนี้</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32" data-testid="select-status">
                  <SelectValue placeholder="สถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="draft">ร่าง</SelectItem>
                  <SelectItem value="approved">อนุมัติ</SelectItem>
                  <SelectItem value="cancelled">ยกเลิก</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="flexy-card">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80">
                    <TableHead className="text-sm">เลขเอกสาร</TableHead>
                    <TableHead className="text-sm">วันที่</TableHead>
                    <TableHead className="text-sm">ประเภท</TableHead>
                    <TableHead className="text-sm">แพลตฟอร์ม</TableHead>
                    <TableHead className="text-sm">ลูกค้า</TableHead>
                    <TableHead className="text-sm">อ้างอิงออเดอร์</TableHead>
                    <TableHead className="text-sm text-right">ยอดรวม</TableHead>
                    <TableHead className="text-sm text-right">VAT</TableHead>
                    <TableHead className="text-sm">สถานะ</TableHead>
                    <TableHead className="text-sm w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10}>
                        <div className="text-center py-12 text-gray-400">
                          <UtensilsCrossed className="h-10 w-10 mx-auto mb-2 opacity-50" />
                          <p className="text-sm font-medium">ยังไม่มีเอกสารจากออเดอร์อาหาร</p>
                          <p className="text-xs mt-1 mb-3">นำเข้าออเดอร์จาก Excel เพื่อสร้างใบกำกับภาษีอัตโนมัติ</p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate("/food-delivery/import")}
                            className="border-[#05b187] text-[#05b187]"
                            data-testid="btn-empty-import"
                          >
                            <Upload className="h-4 w-4 mr-1.5" />นำเข้าออเดอร์
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDocs.map((doc, idx) => {
                      const platformBadge = getPlatformFromRef(doc.refDoc);
                      return (
                        <TableRow key={`${doc.docType}-${doc.id}`} data-testid={`row-doc-${doc.id}`}>
                          <TableCell className="text-sm font-medium text-[#05b187]">{doc.docNo}</TableCell>
                          <TableCell className="text-sm">{formatDate(doc.docDate, dateEra, dateFmt)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${doc.docType === "tax_invoice" ? "border-blue-200 text-blue-700" : "border-green-200 text-green-700"}`}>
                              {doc.docType === "tax_invoice" ? "ใบกำกับภาษี" : "ใบแจ้งหนี้"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${platformBadge.color}`}>{platformBadge.label}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">{doc.customerName || "-"}</TableCell>
                          <TableCell className="text-xs font-mono text-gray-500 max-w-[160px] truncate">{doc.refDoc || "-"}</TableCell>
                          <TableCell className="text-sm text-right font-medium">฿{formatCurrency(doc.totalAmount)}</TableCell>
                          <TableCell className="text-sm text-right text-blue-600">฿{formatCurrency(doc.vatAmount)}</TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${
                              doc.status === "approved" ? "bg-green-100 text-green-700" :
                              doc.status === "draft" ? "bg-yellow-100 text-yellow-700" :
                              "bg-red-100 text-red-700"
                            }`}>
                              {doc.status === "approved" ? "อนุมัติ" : doc.status === "draft" ? "ร่าง" : doc.status === "cancelled" ? "ยกเลิก" : doc.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                if (doc.docType === "tax_invoice") navigate(`/tax-invoices/${doc.id}`);
                                else navigate(`/invoices/${doc.id}`);
                              }}
                              data-testid={`btn-view-${doc.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {filteredDocs.length > 0 && (
          <div className="flex justify-end">
            <div className="text-sm text-gray-500">
              แสดง {filteredDocs.length} เอกสาร | ยอดรวม ฿{formatCurrency(totalAmount)} | VAT ฿{formatCurrency(totalVat)}
            </div>
          </div>
        )}
      </div>
    </FoodDeliveryLayout>
  );
}
