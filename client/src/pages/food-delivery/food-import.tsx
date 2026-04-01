import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import FoodDeliveryLayout from "@/components/food-delivery-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import { formatDate } from "@/lib/format";
import { useDateSettings } from "@/hooks/use-date-settings";
import {
  Upload, FileSpreadsheet, Eye, CheckCircle2, XCircle,
  AlertCircle, ArrowLeft, FileText, Loader2, ChevronDown, ChevronUp, UtensilsCrossed,
} from "lucide-react";

const PLATFORMS = [
  { value: "grab_food", label: "Grab Food", color: "#00B14F", emoji: "🏍️", bgClass: "bg-green-50 border-green-200", textClass: "text-green-700" },
  { value: "line_man", label: "LINE MAN", color: "#06C755", emoji: "💚", bgClass: "bg-emerald-50 border-emerald-200", textClass: "text-emerald-700" },
  { value: "shopee_food", label: "Shopee Food", color: "#EE4D2D", emoji: "🍊", bgClass: "bg-orange-50 border-orange-200", textClass: "text-orange-700" },
  { value: "robinhood", label: "Robinhood", color: "#7B2D8E", emoji: "🦊", bgClass: "bg-purple-50 border-purple-200", textClass: "text-purple-700" },
];

const DOC_TYPES = [
  { value: "tax_invoice", label: "ใบกำกับภาษี (TIV)", color: "bg-blue-100 text-blue-700" },
  { value: "invoice", label: "ใบแจ้งหนี้ (IV)", color: "bg-green-100 text-green-700" },
];

interface ParsedItem {
  sku: string;
  productName: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
  discount: number;
  vatType: string;
}

interface ParsedOrder {
  orderNo: string;
  platform: string;
  orderDate: string;
  status: string;
  buyerName: string;
  buyerPhone: string;
  buyerAddress: string;
  trackingNo: string;
  shippingProvider: string;
  shippingFee: number;
  platformDiscount: number;
  sellerDiscount: number;
  orderTotal: number;
  paymentMethod: string;
  commissionFee: number;
  subtotal: number;
  items: ParsedItem[];
}

interface PreviewResult {
  platform: string;
  totalRows: number;
  totalOrders: number;
  headers: string[];
  columnMapping: Record<string, string | null>;
  orders: ParsedOrder[];
}

function formatCurrency(v: number) {
  return v.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function FoodImport() {
  const [, navigate] = useLocation();
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

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
  const [platform, setPlatform] = useState("");
  const [documentType, setDocumentType] = useState("tax_invoice");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [createResult, setCreateResult] = useState<any>(null);
  const [fileName, setFileName] = useState("");

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/ecommerce/import/preview", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "อัปโหลดล้มเหลว");
      }
      return res.json() as Promise<PreviewResult>;
    },
    onSuccess: (data) => {
      setPreview(data);
      setSelectedOrders(new Set(data.orders.map(o => o.orderNo)));
      setStep("preview");
      toast({ title: `พบ ${data.totalOrders} ออเดอร์จาก ${data.totalRows} แถว` });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error("ไม่มีข้อมูล");
      const selectedOrderData = preview.orders.filter(o => selectedOrders.has(o.orderNo));
      const res = await fetch("/api/ecommerce/import/create-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: selectedCompanyId,
          documentType,
          platform,
          orders: selectedOrderData,
        }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "สร้างเอกสารล้มเหลว");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setCreateResult(data);
      setStep("result");
      toast({
        title: `สร้างเอกสารสำเร็จ ${data.totalCreated} รายการ`,
        description: data.totalErrors > 0 ? `มีข้อผิดพลาด ${data.totalErrors} รายการ` : undefined,
      });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    if (!platform) {
      toast({ title: "กรุณาเลือกแพลตฟอร์มก่อน", variant: "destructive" });
      return;
    }
    if (!selectedCompanyId) {
      toast({ title: "กรุณาเลือกกิจการก่อน", variant: "destructive" });
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    formData.append("platform", platform);
    formData.append("companyId", String(selectedCompanyId));
    uploadMutation.mutate(formData);
  };

  const toggleOrder = (orderNo: string) => {
    const newSet = new Set(selectedOrders);
    if (newSet.has(orderNo)) newSet.delete(orderNo);
    else newSet.add(orderNo);
    setSelectedOrders(newSet);
  };

  const toggleAll = () => {
    if (!preview) return;
    if (selectedOrders.size === preview.orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(preview.orders.map(o => o.orderNo)));
    }
  };

  const toggleExpand = (orderNo: string) => {
    const newSet = new Set(expandedOrders);
    if (newSet.has(orderNo)) newSet.delete(orderNo);
    else newSet.add(orderNo);
    setExpandedOrders(newSet);
  };

  const resetAll = () => {
    setPreview(null);
    setSelectedOrders(new Set());
    setExpandedOrders(new Set());
    setStep("upload");
    setCreateResult(null);
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const platformInfo = PLATFORMS.find(p => p.value === platform);
  const docTypeInfo = DOC_TYPES.find(d => d.value === documentType);

  return (
    <FoodDeliveryLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/food-delivery/orders")} data-testid="btn-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">นำเข้าออเดอร์จาก Excel</h1>
            <p className="text-sm text-gray-500">อัปโหลดรายงานออเดอร์จากแพลตฟอร์มอาหาร เพื่อสร้างใบกำกับภาษีอัตโนมัติ</p>
          </div>
        </div>

        {step === "upload" && (
          <div className="space-y-4">
            <Card className="flexy-card">
              <CardHeader className="pb-3">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <UtensilsCrossed className="h-5 w-5 text-[#05b187]" />
                  ขั้นตอนที่ 1: เลือกแพลตฟอร์มและอัปโหลดไฟล์
                </h2>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">เลือกแพลตฟอร์ม</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {PLATFORMS.map(p => (
                      <button
                        key={p.value}
                        data-testid={`btn-platform-${p.value}`}
                        onClick={() => setPlatform(p.value)}
                        className={`p-5 rounded-xl border-2 transition-all text-center font-semibold ${
                          platform === p.value
                            ? `ring-2 ring-offset-1 ${p.bgClass}`
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                        style={platform === p.value ? { borderColor: p.color, boxShadow: `0 0 0 2px ${p.color}33` } : {}}
                      >
                        <div className="text-2xl mb-2">{p.emoji}</div>
                        <div className={platform === p.value ? p.textClass : "text-gray-600"}>{p.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">ประเภทเอกสารที่ต้องการสร้าง</label>
                  <Select value={documentType} onValueChange={setDocumentType}>
                    <SelectTrigger className="rounded-lg" data-testid="select-doc-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map(d => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">อัปโหลดไฟล์ Excel / CSV</label>
                  <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                      platform ? "border-gray-300 hover:border-[#05b187] hover:bg-green-50/30" : "border-gray-200 bg-gray-50 cursor-not-allowed"
                    }`}
                    onClick={() => platform && fileRef.current?.click()}
                    data-testid="dropzone-upload"
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileSelect}
                      className="hidden"
                      data-testid="input-file"
                    />
                    {uploadMutation.isPending ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-10 w-10 animate-spin text-[#05b187]" />
                        <span className="text-sm text-gray-600">กำลังวิเคราะห์ไฟล์...</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-10 w-10 mx-auto mb-3 text-gray-400" />
                        <p className="text-sm text-gray-600 mb-1">
                          {platform ? "คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวาง" : "กรุณาเลือกแพลตฟอร์มก่อน"}
                        </p>
                        <p className="text-xs text-gray-400">รองรับ .xlsx, .xls, .csv (สูงสุด 5,000 แถว)</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-emerald-50 rounded-lg p-4 text-sm text-emerald-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium mb-1">วิธีดาวน์โหลดรายงานจากแพลตฟอร์ม:</p>
                      <ul className="list-disc list-inside space-y-0.5 text-emerald-700">
                        <li><strong>Grab Food:</strong> Merchant Portal → รายการออเดอร์ → ดาวน์โหลด Excel</li>
                        <li><strong>LINE MAN:</strong> Merchant Portal → ประวัติออเดอร์ → ส่งออกข้อมูล</li>
                        <li><strong>Shopee Food:</strong> Seller Centre → ShopeeFood → รายงาน → ดาวน์โหลด Excel</li>
                        <li><strong>Robinhood:</strong> ระบบร้านค้า → รายงานการขาย → ดาวน์โหลด</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === "preview" && preview && (
          <div className="space-y-4">
            <Card className="flexy-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Eye className="h-5 w-5 text-[#05b187]" />
                    ตรวจสอบข้อมูลก่อนสร้างเอกสาร
                  </h2>
                  <Button variant="outline" size="sm" onClick={resetAll} data-testid="btn-reset">
                    <ArrowLeft className="h-4 w-4 mr-1" /> เลือกไฟล์ใหม่
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500">แพลตฟอร์ม</div>
                    <div className="font-semibold text-sm" data-testid="text-platform">{platformInfo?.label || platform}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500">ไฟล์</div>
                    <div className="font-semibold text-sm truncate" data-testid="text-filename">{fileName}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500">จำนวนแถว</div>
                    <div className="font-semibold text-sm" data-testid="text-total-rows">{preview.totalRows.toLocaleString()}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500">ออเดอร์</div>
                    <div className="font-semibold text-sm" data-testid="text-total-orders">{preview.totalOrders.toLocaleString()}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500">เลือกแล้ว</div>
                    <div className="font-semibold text-sm text-[#05b187]" data-testid="text-selected">{selectedOrders.size}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedOrders.size === preview.orders.length}
                      onCheckedChange={toggleAll}
                      data-testid="checkbox-select-all"
                    />
                    <span className="text-sm text-gray-600">เลือกทั้งหมด</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={docTypeInfo?.color}>{docTypeInfo?.label}</Badge>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-10"></TableHead>
                        <TableHead className="w-10"></TableHead>
                        <TableHead className="text-sm">เลขออเดอร์</TableHead>
                        <TableHead className="text-sm">วันที่</TableHead>
                        <TableHead className="text-sm">ลูกค้า</TableHead>
                        <TableHead className="text-sm">รายการ</TableHead>
                        <TableHead className="text-sm">ค่า GP</TableHead>
                        <TableHead className="text-sm text-right">ยอดรวม</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.orders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-gray-400">
                            ไม่พบออเดอร์ในไฟล์
                          </TableCell>
                        </TableRow>
                      ) : (
                        preview.orders.map((order) => {
                          const isSelected = selectedOrders.has(order.orderNo);
                          const isExpanded = expandedOrders.has(order.orderNo);
                          return (
                            <> 
                              <TableRow
                                key={order.orderNo}
                                className={`cursor-pointer ${isSelected ? "bg-green-50/50" : ""}`}
                                data-testid={`row-order-${order.orderNo}`}
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleOrder(order.orderNo)}
                                    data-testid={`checkbox-order-${order.orderNo}`}
                                  />
                                </TableCell>
                                <TableCell>
                                  <button onClick={() => toggleExpand(order.orderNo)} className="text-gray-400 hover:text-gray-600">
                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </button>
                                </TableCell>
                                <TableCell className="text-sm font-mono">{order.orderNo}</TableCell>
                                <TableCell className="text-sm">{formatDate(order.orderDate, dateEra, dateFmt)}</TableCell>
                                <TableCell className="text-sm">{order.buyerName}</TableCell>
                                <TableCell className="text-sm">{order.items.length} รายการ</TableCell>
                                <TableCell className="text-sm text-orange-600">
                                  {order.commissionFee > 0 ? `฿${formatCurrency(order.commissionFee)}` : "-"}
                                </TableCell>
                                <TableCell className="text-sm text-right font-medium">฿{formatCurrency(order.subtotal)}</TableCell>
                              </TableRow>
                              {isExpanded && (
                                <TableRow key={`${order.orderNo}-detail`}>
                                  <TableCell colSpan={8} className="bg-gray-50/50 p-0">
                                    <div className="px-4 py-2">
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2 text-xs text-gray-500">
                                        {order.paymentMethod && <div>ชำระ: <span className="text-gray-700">{order.paymentMethod}</span></div>}
                                        {order.buyerPhone && <div>โทร: <span className="text-gray-700">{order.buyerPhone}</span></div>}
                                        {order.shippingFee > 0 && <div>ค่าส่ง: <span className="text-gray-700">฿{formatCurrency(order.shippingFee)}</span></div>}
                                        {order.platformDiscount > 0 && <div>ส่วนลดแพลตฟอร์ม: <span className="text-red-600">-฿{formatCurrency(order.platformDiscount)}</span></div>}
                                      </div>
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="border-b">
                                            <th className="text-left py-1 px-2">รหัส</th>
                                            <th className="text-left py-1 px-2">ชื่อเมนู</th>
                                            <th className="text-right py-1 px-2">จำนวน</th>
                                            <th className="text-right py-1 px-2">ราคา/หน่วย</th>
                                            <th className="text-right py-1 px-2">รวม</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {order.items.map((item, idx) => (
                                            <tr key={idx} className="border-b border-gray-100">
                                              <td className="py-1 px-2 font-mono text-gray-500">{item.sku || "-"}</td>
                                              <td className="py-1 px-2">{item.productName}</td>
                                              <td className="py-1 px-2 text-right">{item.qty}</td>
                                              <td className="py-1 px-2 text-right">฿{formatCurrency(item.unitPrice)}</td>
                                              <td className="py-1 px-2 text-right font-medium">฿{formatCurrency(item.totalPrice)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                      {order.buyerAddress && (
                                        <div className="mt-2 text-xs text-gray-500">ที่อยู่: {order.buyerAddress}</div>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-gray-500">
                    เลือก {selectedOrders.size} จาก {preview.orders.length} ออเดอร์
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={resetAll} data-testid="btn-cancel">
                      ยกเลิก
                    </Button>
                    <Button
                      onClick={() => createMutation.mutate()}
                      disabled={selectedOrders.size === 0 || createMutation.isPending}
                      style={{ background: "#05b187" }}
                      className="text-white hover:opacity-90"
                      data-testid="btn-create-docs"
                    >
                      {createMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />กำลังสร้าง...</>
                      ) : (
                        <><FileText className="h-4 w-4 mr-1.5" />สร้างเอกสาร {selectedOrders.size} รายการ</>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === "result" && createResult && (
          <div className="space-y-4">
            <Card className="flexy-card">
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  <div className="h-16 w-16 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: "#e8f8f2" }}>
                    <CheckCircle2 className="h-8 w-8 text-[#05b187]" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-800">สร้างเอกสารเสร็จสิ้น</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    สร้างสำเร็จ {createResult.totalCreated} รายการ
                    {createResult.totalSkipped > 0 && ` | ข้าม ${createResult.totalSkipped} รายการ (นำเข้าแล้ว)`}
                    {createResult.totalErrors > 0 && ` | ผิดพลาด ${createResult.totalErrors} รายการ`}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-[#05b187]" />
                    <div className="text-2xl font-bold text-[#05b187]">{createResult.totalCreated}</div>
                    <div className="text-xs text-green-600">สร้างสำเร็จ</div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4 text-center">
                    <AlertCircle className="h-5 w-5 mx-auto mb-1 text-amber-500" />
                    <div className="text-2xl font-bold text-amber-600">{createResult.totalSkipped || 0}</div>
                    <div className="text-xs text-amber-600">ข้าม (ซ้ำ)</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 text-center">
                    <XCircle className="h-5 w-5 mx-auto mb-1 text-red-500" />
                    <div className="text-2xl font-bold text-red-600">{createResult.totalErrors || 0}</div>
                    <div className="text-xs text-red-600">ผิดพลาด</div>
                  </div>
                </div>

                {createResult.documents && createResult.documents.length > 0 && (
                  <div className="border rounded-lg overflow-hidden mb-4">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-sm">เลขออเดอร์</TableHead>
                          <TableHead className="text-sm">เลขเอกสาร</TableHead>
                          <TableHead className="text-sm">ประเภท</TableHead>
                          <TableHead className="text-sm">สถานะ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {createResult.documents.map((doc: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="text-sm font-mono">{doc.orderNo}</TableCell>
                            <TableCell className="text-sm font-medium text-[#05b187]">{doc.docNo}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{doc.type === "tax_invoice" ? "ใบกำกับภาษี" : "ใบแจ้งหนี้"}</Badge></TableCell>
                            <TableCell><Badge className="bg-green-100 text-green-700 text-xs">สำเร็จ</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="flex justify-center gap-3">
                  <Button variant="outline" onClick={resetAll} data-testid="btn-import-more">
                    <FileSpreadsheet className="h-4 w-4 mr-1.5" />นำเข้าเพิ่ม
                  </Button>
                  <Button
                    onClick={() => navigate("/food-delivery/accounting")}
                    style={{ background: "#05b187" }}
                    className="text-white hover:opacity-90"
                    data-testid="btn-view-accounting"
                  >
                    <FileText className="h-4 w-4 mr-1.5" />ดูเอกสารบัญชี
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </FoodDeliveryLayout>
  );
}
