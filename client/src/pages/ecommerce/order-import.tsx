import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import EcommerceLayout from "@/components/ecommerce-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import { formatDate } from "@/lib/format";
import {
  Upload, ShoppingCart, Eye, CheckCircle2,
  AlertCircle, ArrowLeft, FileText, Loader2, ChevronDown, ChevronUp,
  Trash2, History, RotateCcw, Package, TrendingDown, Truck, Receipt, Store,
} from "lucide-react";
import { useDateSettings } from "@/hooks/use-date-settings";
import type { EcommerceConnection } from "@shared/schema";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const PLATFORMS = [
  { value: "shopee", label: "Shopee", color: "#F26522", bgClass: "bg-orange-50 border-orange-200", textClass: "text-orange-700" },
  { value: "lazada", label: "Lazada", color: "#0F146D", bgClass: "bg-indigo-50 border-indigo-200", textClass: "text-indigo-700" },
  { value: "tiktok", label: "TikTok Shop", color: "#000000", bgClass: "bg-gray-50 border-gray-200", textClass: "text-gray-700" },
  { value: "facebook", label: "Facebook", color: "#1877F2", bgClass: "bg-blue-50 border-blue-200", textClass: "text-blue-700" },
  { value: "amazon", label: "Amazon", color: "#FF9900", bgClass: "bg-yellow-50 border-yellow-200", textClass: "text-yellow-700" },
];

const DOC_TYPES = [
  { value: "invoice", label: "ใบแจ้งหนี้ (IV)", color: "bg-green-100 text-green-700" },
  { value: "tax_invoice", label: "ใบกำกับภาษี (TIV)", color: "bg-blue-100 text-blue-700" },
];

interface ParsedItem {
  sku: string;
  productName: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
  discount: number;
  sellerVoucherDiscount?: number;
  sellerCoinsCashback?: number;
  sellerBundleDeal?: number;
  grossSellingPrice?: number;
  vatType: string;
}

interface ParsedOrder {
  orderNo: string;
  platform: string;
  orderDate: string;
  completedDate?: string;
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
  buyerPaidPrice?: number;
  shippingBuyerPaid?: number;
  shippingShopeeSubsidy?: number;
  shippingActualCost?: number;
  commission?: number;
  transactionFee?: number;
  serviceFee?: number;
  netAmount?: number;
  totalFees?: number;
  items: ParsedItem[];
}

interface PreviewResult {
  platform: string;
  totalRows: number;
  totalOrders: number;
  totalCompleted?: number;
  totalCancelled?: number;
  totalSkipped?: number;
  grandTotalSales?: number;
  grandTotalFees?: number;
  grandTotalShipping?: number;
  grandTotalShippingBuyerPaid?: number;
  grandTotalShippingShopeeSubsidy?: number;
  grandTotalShippingSellerPaid?: number;
  headers: string[];
  columnMapping: Record<string, string | null>;
  orders: ParsedOrder[];
}

interface ImportBatch {
  id: number;
  platform: string;
  fileName: string;
  totalOrders: number;
  totalSkipped: number;
  totalErrors: number;
  totalTaxInvoices: number;
  totalJournalEntries: number;
  status: string;
  createdAt: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OrderImport() {
  const [, navigate] = useLocation();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
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
  const [platform, setPlatform] = useState("");
  const [selectedConnectionId, setSelectedConnectionId] = useState<number | null>(null);
  const [documentType, setDocumentType] = useState("tax_invoice");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<"upload" | "preview" | "result" | "history" | "returns" | "returns_preview" | "returns_result">("upload");
  const [createResult, setCreateResult] = useState<any>(null);
  const [fileName, setFileName] = useState("");
  const [previewPage, setPreviewPage] = useState(0);
  const PREVIEW_PAGE_SIZE = 100;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingBatchId, setDeletingBatchId] = useState<number | null>(null);
  const [returnOrderNumbers, setReturnOrderNumbers] = useState("");
  const [returnPreview, setReturnPreview] = useState<any>(null);
  const [returnResult, setReturnResult] = useState<any>(null);
  const [vatDialogOpen, setVatDialogOpen] = useState(false);
  const [vatAnalyzing, setVatAnalyzing] = useState(false);
  const [vatItems, setVatItems] = useState<{ productName: string; vatType: string; source: string; confidence: string }[]>([]);
  const [returnReason, setReturnReason] = useState("ลูกค้าขอคืนสินค้า/ยกเลิกคำสั่งซื้อ");
  const [returnFileName, setReturnFileName] = useState("");
  const returnFileRef = useRef<HTMLInputElement>(null);
  const [chunkProgress, setChunkProgress] = useState<{ current: number; total: number; created: number; errors: number; skipped: number } | null>(null);
  const [includeShippingInTiv, setIncludeShippingInTiv] = useState(true);

  const { data: batches, isLoading: batchesLoading } = useQuery<ImportBatch[]>({
    queryKey: ["/api/ecommerce/import/batches", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      const res = await fetch(`/api/ecommerce/import/batches?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: connections = [] } = useQuery<EcommerceConnection[]>({
    queryKey: ["/api/ecommerce/connections", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      const r = await fetch(`/api/ecommerce/connections?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const platformConnections = connections.filter(c => c.platform === platform);
  const selectedConnection = connections.find(c => c.id === selectedConnectionId) || null;

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/ecommerce/import/preview", {
        method: "POST",
        body: formData,
        credentials: "include",
        signal: AbortSignal.timeout(300000),
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
      setPreviewPage(0);
      setStep("preview");
      const msg = platform === "shopee"
        ? `พบ ${data.totalCompleted || data.totalOrders} ออเดอร์สำเร็จ จาก ${data.totalRows} แถว${data.totalCancelled ? ` (ยกเลิก ${data.totalCancelled})` : ""}`
        : `พบ ${data.totalOrders} คำสั่งซื้อจาก ${data.totalRows} แถว`;
      toast({ title: msg });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const handleStartVatCheck = async () => {
    if (!preview || !selectedCompanyId) return;
    const companyName = selectedCompany?.name || "";
    if (companyName && !confirm(`ยืนยันสร้างเอกสารเข้าบริษัท:\n"${companyName}"\n\nกรุณาตรวจสอบว่าเลือกบริษัทถูกต้อง`)) return;
    const selectedOrderData = preview.orders.filter(o => selectedOrders.has(o.orderNo));
    const allProductNames = Array.from(new Set(selectedOrderData.flatMap(o => o.items.map(i => i.productName)).filter(Boolean)));
    if (allProductNames.length === 0) {
      proceedWithCreate(selectedOrderData);
      return;
    }
    setVatAnalyzing(true);
    try {
      const res = await fetch("/api/vat-dictionary/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: selectedCompanyId, productNames: allProductNames }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("วิเคราะห์ VAT ไม่สำเร็จ");
      const data = await res.json();
      setVatItems(data.results || []);
      setVatDialogOpen(true);
    } catch (err: any) {
      toast({ title: "ไม่สามารถวิเคราะห์ VAT ได้", description: err.message, variant: "destructive" });
      const fallback = allProductNames.map(p => ({ productName: p, vatType: "vat7", source: "default", confidence: "default" }));
      setVatItems(fallback);
      setVatDialogOpen(true);
    } finally {
      setVatAnalyzing(false);
    }
  };

  const handleVatConfirm = async () => {
    if (!preview || !selectedCompanyId) return;
    try {
      await fetch("/api/vat-dictionary/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: selectedCompanyId,
          items: vatItems.map(v => ({ productName: v.productName, vatType: v.vatType, source: v.source === "dictionary" ? "confirmed" : "ai_confirmed" })),
        }),
        credentials: "include",
      });
    } catch {}
    const vatMap = new Map(vatItems.map(v => [v.productName, v.vatType]));
    const selectedOrderData = preview.orders.filter(o => selectedOrders.has(o.orderNo)).map(o => ({
      ...o,
      items: o.items.map(item => ({ ...item, vatType: vatMap.get(item.productName) || item.vatType || "vat7" })),
    }));
    setVatDialogOpen(false);
    proceedWithCreate(selectedOrderData);
  };

  const CHUNK_SIZE = 500;

  const proceedWithCreate = (orderData: ParsedOrder[]) => {
    createMutation.mutate(orderData);
  };

  const createMutation = useMutation({
    mutationFn: async (orderData: ParsedOrder[]) => {
      const endpoint = "/api/ecommerce/import/create-shopee-batch";
      const totalOrders = orderData.length;
      const chunks: ParsedOrder[][] = [];
      for (let i = 0; i < totalOrders; i += CHUNK_SIZE) {
        chunks.push(orderData.slice(i, i + CHUNK_SIZE));
      }
      const totalChunks = chunks.length;

      let allCreated: any[] = [];
      let allErrors: any[] = [];
      let allSkipped: any[] = [];
      let totalProductsCreated = 0;
      let totalAutoGR = 0;
      let batchId: number | null = null;

      for (let idx = 0; idx < totalChunks; idx++) {
        setChunkProgress({
          current: idx + 1,
          total: totalChunks,
          created: allCreated.length,
          errors: allErrors.length,
          skipped: allSkipped.length,
        });

        const body: any = { companyId: selectedCompanyId, platform, fileName, orders: chunks[idx], includeShippingInTiv, connectionId: selectedConnectionId };
        if (batchId) body.appendToBatchId = batchId;

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "include",
          signal: AbortSignal.timeout(300000),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || `สร้างเอกสารล้มเหลว (ชุดที่ ${idx + 1}/${totalChunks})`);
        }
        const data = await res.json();
        allCreated = allCreated.concat(data.createdDocs || []);
        allErrors = allErrors.concat(data.errors || []);
        allSkipped = allSkipped.concat(data.skipped || []);
        totalProductsCreated += data.productsCreated || 0;
        totalAutoGR += data.autoGRCount || 0;
        if (!batchId && data.batchId) batchId = data.batchId;
      }

      setChunkProgress(null);

      return {
        batchId,
        totalCreated: allCreated.length,
        totalErrors: allErrors.length,
        totalSkipped: allSkipped.length,
        productsCreated: totalProductsCreated,
        createdDocs: allCreated,
        errors: allErrors,
        skipped: allSkipped,
        autoGRCount: totalAutoGR,
        chunksProcessed: totalChunks,
      };
    },
    onSuccess: (data) => {
      setCreateResult(data);
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/import/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tax-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({
        title: `สร้างเอกสารสำเร็จ ${data.totalCreated} รายการ`,
        description: [
          data.productsCreated > 0 ? `เพิ่มสินค้าใหม่ ${data.productsCreated} รายการ` : null,
          data.totalErrors > 0 ? `มีข้อผิดพลาด ${data.totalErrors} รายการ` : null,
          (data.chunksProcessed || 0) > 1 ? `ประมวลผล ${data.chunksProcessed} ชุด` : null,
        ].filter(Boolean).join(" | ") || undefined,
      });
    },
    onError: (err: any) => {
      setChunkProgress(null);
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const deleteBatchMutation = useMutation({
    mutationFn: async (batchId: number) => {
      const res = await fetch(`/api/ecommerce/import/batch/${batchId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "ลบ batch ล้มเหลว");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/import/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tax-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setDeleteDialogOpen(false);
      setDeletingBatchId(null);
      toast({ title: "ลบการนำเข้าสำเร็จ", description: `ลบออเดอร์ ${data.deletedOrders} รายการ, ใบกำกับภาษี ${data.deletedTaxInvoices} ใบ, บันทึกบัญชี ${data.deletedJournalEntries} รายการ` });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const handleReturnExcelUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReturnFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

        const orderNos: string[] = [];
        let orderColIdx = -1;

        if (rows.length > 0) {
          const headerRow = rows[0].map((h: any) => String(h).toLowerCase().trim());
          orderColIdx = headerRow.findIndex((h: string) =>
            h.includes("order") || h.includes("เลขคำสั่งซื้อ") || h.includes("เลขออเดอร์") ||
            h.includes("order_sn") || h.includes("ordersn") || h.includes("order no") ||
            h.includes("order id") || h.includes("หมายเลข") || h.includes("คำสั่งซื้อ")
          );
        }

        const startRow = orderColIdx >= 0 ? 1 : 0;
        const colIdx = orderColIdx >= 0 ? orderColIdx : 0;

        for (let i = startRow; i < rows.length; i++) {
          const val = String(rows[i][colIdx] || "").trim();
          if (val && val.length > 3) {
            orderNos.push(val);
          }
        }

        if (orderNos.length === 0) {
          toast({ title: "ไม่พบเลขคำสั่งซื้อในไฟล์", description: "กรุณาตรวจสอบว่าไฟล์มีคอลัมน์เลขออเดอร์", variant: "destructive" });
          return;
        }

        setReturnOrderNumbers(orderNos.join("\n"));
        toast({ title: `อ่านเลขคำสั่งซื้อจากไฟล์ ${file.name}`, description: `พบ ${orderNos.length} รายการ` });
      } catch (err) {
        toast({ title: "อ่านไฟล์ไม่สำเร็จ", description: "กรุณาตรวจสอบรูปแบบไฟล์ Excel", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
    if (returnFileRef.current) returnFileRef.current.value = "";
  }, [toast]);

  const returnPreviewMutation = useMutation({
    mutationFn: async () => {
      const orderNos = returnOrderNumbers.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
      if (orderNos.length === 0) throw new Error("กรุณาระบุเลขคำสั่งซื้อ");
      const res = await fetch("/api/ecommerce/import/preview-returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: selectedCompanyId, orderNumbers: orderNos }),
        credentials: "include",
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: (data) => {
      setReturnPreview(data);
      setStep("returns_preview");
      toast({ title: `พบ ${data.totalEligible} ออเดอร์ที่สามารถออกใบลดหนี้ได้` });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const createReturnMutation = useMutation({
    mutationFn: async () => {
      if (!returnPreview || returnPreview.orders.length === 0) throw new Error("ไม่มีข้อมูล");
      const res = await fetch("/api/ecommerce/import/create-return-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: selectedCompanyId,
          platform: returnPreview.orders[0]?.platform || "shopee",
          orders: returnPreview.orders.map((o: any) => ({
            orderNo: o.orderNo,
            returnReason,
            returnDate: new Date().toISOString().split("T")[0],
          })),
        }),
        credentials: "include",
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: (data) => {
      setReturnResult(data);
      setStep("returns_result");
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/import/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/returns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tax-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({ title: `สร้างใบลดหนี้สำเร็จ ${data.totalCreated} รายการ` });
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
  const activeBatches = (batches || []).filter(b => b.status === "active");
  const isShopee = platform === "shopee";
  const hasDetailedFees = platform === "shopee" || platform === "tiktok";

  return (
    <EcommerceLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/ecommerce/orders")} data-testid="btn-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">นำเข้าคำสั่งซื้อจาก Excel</h1>
              <p className="text-sm text-gray-500">อัปโหลดไฟล์รายงานคำสั่งซื้อจากแพลตฟอร์มเพื่อสร้างเอกสารขายอัตโนมัติ</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className={step === "returns" || step === "returns_preview" || step === "returns_result" ? "border-[#f94d4d] text-[#f94d4d]" : ""}
              onClick={() => {
                if (step === "returns" || step === "returns_preview" || step === "returns_result") {
                  setStep("upload"); setReturnPreview(null); setReturnResult(null); setReturnOrderNumbers("");
                } else {
                  setStep("returns");
                }
              }}
              data-testid="btn-returns"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              ใบลดหนี้ (คืนสินค้า)
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={step === "history" ? "border-[#fb9678] text-[#fb9678]" : ""}
              onClick={() => setStep(step === "history" ? "upload" : "history")}
              data-testid="btn-history"
            >
              <History className="h-4 w-4 mr-1" />
              ประวัติการนำเข้า {activeBatches.length > 0 && <Badge className="ml-1 bg-[#fb9678] text-white text-xs h-5 px-1.5">{activeBatches.length}</Badge>}
            </Button>
          </div>
        </div>

        {step === "history" && (
          <Card className="flexy-card">
            <CardHeader className="pb-3">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <History className="h-5 w-5 text-[#fb9678]" />
                ประวัติการนำเข้า
              </h2>
            </CardHeader>
            <CardContent>
              {batchesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : activeBatches.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                  <p>ยังไม่มีประวัติการนำเข้า</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="text-sm">วันที่</TableHead>
                        <TableHead className="text-sm">แพลตฟอร์ม</TableHead>
                        <TableHead className="text-sm">ไฟล์</TableHead>
                        <TableHead className="text-sm text-center">ออเดอร์</TableHead>
                        <TableHead className="text-sm text-center">ใบกำกับภาษี</TableHead>
                        <TableHead className="text-sm text-center">บันทึกบัญชี</TableHead>
                        <TableHead className="text-sm text-center">สถานะ</TableHead>
                        <TableHead className="text-sm text-center">ดำเนินการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeBatches.map((batch) => {
                        const pInfo = PLATFORMS.find(p => p.value === batch.platform);
                        return (
                          <TableRow key={batch.id} data-testid={`row-batch-${batch.id}`}>
                            <TableCell className="text-sm">{formatDate(batch.createdAt, dateEra, dateFmt)}</TableCell>
                            <TableCell>
                              <Badge className={pInfo?.bgClass || "bg-gray-100"} variant="outline">
                                <span className={pInfo?.textClass}>{pInfo?.label || batch.platform}</span>
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm truncate max-w-[200px]">{batch.fileName || "-"}</TableCell>
                            <TableCell className="text-sm text-center font-medium">{batch.totalOrders}</TableCell>
                            <TableCell className="text-sm text-center font-medium text-blue-600">{batch.totalTaxInvoices}</TableCell>
                            <TableCell className="text-sm text-center font-medium text-green-600">{batch.totalJournalEntries}</TableCell>
                            <TableCell className="text-center">
                              <Badge className={batch.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
                                {batch.status === "active" ? "ใช้งาน" : "ลบแล้ว"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {batch.status === "active" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => { setDeletingBatchId(batch.id); setDeleteDialogOpen(true); }}
                                  data-testid={`btn-delete-batch-${batch.id}`}
                                >
                                  <RotateCcw className="h-4 w-4 mr-1" />
                                  ยกเลิกการนำเข้า
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === "upload" && (
          <div className="space-y-4">
            {selectedCompany && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex items-center gap-3" data-testid="banner-company-confirm">
                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Store className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-amber-700 font-medium">กำลังนำเข้าออเดอร์เข้าบริษัท:</p>
                  <p className="text-base font-bold text-amber-900" data-testid="text-import-company-name">{selectedCompany.name}</p>
                </div>
              </div>
            )}
            <Card className="flexy-card">
              <CardHeader className="pb-3">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-[#fb9678]" />
                  ขั้นตอนที่ 1: เลือกแพลตฟอร์มและอัปโหลดไฟล์
                </h2>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">เลือกแพลตฟอร์ม</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {PLATFORMS.map(p => (
                      <button
                        key={p.value}
                        data-testid={`btn-platform-${p.value}`}
                        onClick={() => { setPlatform(p.value); setSelectedConnectionId(null); }}
                        className={`p-4 rounded-xl border-2 transition-all text-center font-semibold ${
                          platform === p.value
                            ? `${p.bgClass} ring-2 ring-offset-1`
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                        style={platform === p.value ? { borderColor: p.color, boxShadow: `0 0 0 2px ${p.color}30` } : {}}
                      >
                        <div className="text-lg mb-1">{p.value === "shopee" ? "🛒" : p.value === "lazada" ? "🏪" : p.value === "tiktok" ? "🎵" : p.value === "facebook" ? "📘" : "📦"}</div>
                        <div className={platform === p.value ? p.textClass : "text-gray-600"}>{p.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {platform && platformConnections.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      <Store className="h-4 w-4 inline mr-1" />
                      เลือกร้านค้า
                    </label>
                    <Select
                      value={selectedConnectionId ? String(selectedConnectionId) : ""}
                      onValueChange={v => setSelectedConnectionId(v ? Number(v) : null)}
                    >
                      <SelectTrigger className="rounded-lg" data-testid="select-connection">
                        <SelectValue placeholder="เลือกร้านค้าที่จะนำเข้า" />
                      </SelectTrigger>
                      <SelectContent>
                        {platformConnections.map(c => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.shopName} {c.docPrefix ? `(${c.docPrefix})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedConnection?.docPrefix && (
                      <p className="text-xs text-blue-600 mt-1">
                        Prefix เอกสาร: <span className="font-semibold">{selectedConnection.docPrefix}</span> → เลขใบกำกับ: {selectedConnection.docPrefix}-0001, {selectedConnection.docPrefix}-0002...
                      </p>
                    )}
                  </div>
                )}

                {platform && platformConnections.length === 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                    <AlertCircle className="h-4 w-4 inline mr-1" />
                    ยังไม่มีร้านค้า {PLATFORMS.find(p => p.value === platform)?.label} — 
                    <a href="/ecommerce/connections" className="underline font-medium ml-1" data-testid="link-add-connection">
                      ไปเพิ่มร้านค้าก่อน
                    </a>
                  </div>
                )}

                {platform && platform !== "shopee" && (
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
                )}

                {platform && (() => {
                  const PLATFORM_ACCOUNTS: Record<string, { ar: string; arName: string; rev: string; revName: string }> = {
                    shopee:  { ar: "1231000", arName: "ลูกหนี้ Shopee", rev: "4011000", revName: "รายได้จากการขาย Shopee" },
                    lazada:  { ar: "1232000", arName: "ลูกหนี้ Lazada", rev: "4012000", revName: "รายได้จากการขาย Lazada" },
                    tiktok:  { ar: "1233000", arName: "ลูกหนี้ TikTok Shop", rev: "4013000", revName: "รายได้จากการขาย TikTok Shop" },
                    live:    { ar: "1234000", arName: "ลูกหนี้ Facebook", rev: "4014000", revName: "รายได้จากการขาย Facebook" },
                    other:   { ar: "1234000", arName: "ลูกหนี้แพลตฟอร์มอื่น", rev: "4014000", revName: "รายได้จากเว็บไซต์/ขายตรง" },
                  };
                  const pa = PLATFORM_ACCOUNTS[platform] || PLATFORM_ACCOUNTS["other"];
                  return (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                      <div className="flex items-start gap-2">
                        <Receipt className="h-4 w-4 mt-0.5 text-blue-600 flex-shrink-0" />
                        <div className="text-blue-800">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium">บัญชีนำเข้า {PLATFORMS.find(p => p.value === platform)?.label || platform}</p>
                            <Link href="/coa" className="text-[10px] text-blue-500 hover:text-blue-700 underline" data-testid="link-edit-coa">ดูผังบัญชี</Link>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-1">
                            <Badge variant="outline" className="text-xs border-green-400 text-green-700 bg-green-50">DR {pa.ar} {pa.arName}</Badge>
                            <Badge variant="outline" className="text-xs border-red-400 text-red-700 bg-red-50">CR {pa.rev} {pa.revName}</Badge>
                            <Badge variant="outline" className="text-xs border-red-400 text-red-700 bg-red-50">CR 2341000 ภาษีขาย</Badge>
                          </div>
                          <p className="text-xs text-blue-600 mt-2">ค่าธรรมเนียม/ค่าขนส่งจะบันทึกตอน Settlement</p>
                          <ul className="list-disc list-inside space-y-0.5 text-blue-700 text-xs mt-2">
                            <li>สร้างใบกำกับภาษี + ลงบัญชีตั้งหนี้อัตโนมัติ</li>
                            <li>เพิ่ม SKU สินค้าใหม่เข้าระบบอัตโนมัติ</li>
                            <li>สามารถยกเลิก (Rollback) ทั้ง batch ได้ภายหลัง</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">อัปโหลดไฟล์ Excel / CSV</label>
                  <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                      platform ? "border-gray-300 hover:border-[#fb9678] hover:bg-orange-50/30" : "border-gray-200 bg-gray-50 cursor-not-allowed"
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
                        <Loader2 className="h-10 w-10 animate-spin text-[#fb9678]" />
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

                <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium mb-1">วิธีดาวน์โหลดรายงานจากแพลตฟอร์ม:</p>
                      <ul className="list-disc list-inside space-y-0.5 text-blue-700">
                        <li><strong>Shopee:</strong> Seller Centre → คำสั่งซื้อของฉัน → ส่งออก → เลือก "สำเร็จแล้ว"</li>
                        <li><strong>Lazada:</strong> Seller Center → คำสั่งซื้อ → ส่งออกข้อมูล</li>
                        <li><strong>TikTok:</strong> TikTok Shop Seller Center → คำสั่งซื้อ → ส่งออก</li>
                        <li><strong>Amazon:</strong> Amazon Seller Central → Orders → Order Reports → Download</li>
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
                    <Eye className="h-5 w-5 text-[#03c9d7]" />
                    ตรวจสอบข้อมูลก่อนสร้างเอกสาร
                  </h2>
                  <Button variant="outline" size="sm" onClick={resetAll} data-testid="btn-reset">
                    <ArrowLeft className="h-4 w-4 mr-1" /> เลือกไฟล์ใหม่
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className={`grid gap-3 mb-4 ${hasDetailedFees ? "grid-cols-2 md:grid-cols-6" : "grid-cols-2 md:grid-cols-5"}`}>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500">แพลตฟอร์ม</div>
                    <div className="font-semibold text-sm" data-testid="text-platform">{platformInfo?.label || platform}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500">จำนวนแถว</div>
                    <div className="font-semibold text-sm" data-testid="text-total-rows">{preview.totalRows.toLocaleString()}</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500">{hasDetailedFees ? "ออเดอร์สำเร็จ" : "คำสั่งซื้อ"}</div>
                    <div className="font-semibold text-sm text-green-700" data-testid="text-total-orders">{preview.totalOrders.toLocaleString()}</div>
                  </div>
                  {preview.totalCancelled !== undefined && preview.totalCancelled > 0 && (
                    <div className="bg-red-50 rounded-lg p-3 text-center">
                      <div className="text-xs text-gray-500">ยกเลิก/คืน</div>
                      <div className="font-semibold text-sm text-red-600" data-testid="text-cancelled">{preview.totalCancelled}</div>
                    </div>
                  )}
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500">เลือกแล้ว</div>
                    <div className="font-semibold text-sm text-[#05b187]" data-testid="text-selected">{selectedOrders.size}</div>
                  </div>
                  {hasDetailedFees && (
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <div className="text-xs text-gray-500">ไฟล์</div>
                      <div className="font-semibold text-xs truncate" data-testid="text-filename">{fileName}</div>
                    </div>
                  )}
                </div>

                {hasDetailedFees && (
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                      <div className="text-xs text-emerald-600 flex items-center justify-center gap-1"><TrendingDown className="h-3 w-3" /> ยอดขายรวม (หลังหักส่วนลดผู้ขาย)</div>
                      <div className="font-bold text-lg text-emerald-700" data-testid="text-grand-sales">฿{formatCurrency((preview.grandTotalSales || 0) + (includeShippingInTiv ? (preview.grandTotalShippingBuyerPaid || 0) : 0))}</div>
                      <div className="mt-1 space-y-0.5 text-xs">
                        <div className="flex justify-between text-gray-500"><span>ยอดสินค้า (ก่อนหัก)</span><span>฿{formatCurrency(preview.grandTotalSalesGross || preview.grandTotalSales || 0)}</span></div>
                        {(preview.grandTotalSellerDiscount || 0) > 0 && (
                          <div className="flex justify-between text-red-500"><span>− ส่วนลดผู้ขาย</span><span>−฿{formatCurrency(preview.grandTotalSellerDiscount || 0)}</span></div>
                        )}
                        <div className="flex justify-between text-emerald-600 font-medium"><span>ยอดสินค้าสุทธิ</span><span>฿{formatCurrency(preview.grandTotalSales || 0)}</span></div>
                        {(preview.grandTotalShippingBuyerPaid || 0) > 0 && (
                          <div className="flex justify-between text-sky-600"><span>+ ค่าขนส่ง{includeShippingInTiv ? "" : " (ไม่รวม)"}</span><span>{includeShippingInTiv ? "฿" + formatCurrency(preview.grandTotalShippingBuyerPaid || 0) : "—"}</span></div>
                        )}
                      </div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                      <div className="text-xs text-amber-600 flex items-center justify-center gap-1"><Receipt className="h-3 w-3" /> ค่าธรรมเนียมรวม</div>
                      <div className="font-bold text-lg text-amber-700" data-testid="text-grand-fees">฿{formatCurrency(preview.grandTotalFees || 0)}</div>
                    </div>
                    <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-center">
                      <div className="text-xs text-sky-600 flex items-center justify-center gap-1"><Truck className="h-3 w-3" /> ค่าขนส่งตามจริง</div>
                      <div className="font-bold text-lg text-sky-700" data-testid="text-grand-shipping">฿{formatCurrency(preview.grandTotalShipping || 0)}</div>
                      <div className="mt-1 space-y-0.5 text-xs">
                        <div className="flex justify-between text-sky-600"><span>ผู้ซื้อจ่าย</span><span>฿{formatCurrency(preview.grandTotalShippingBuyerPaid || 0)}</span></div>
                        <div className="flex justify-between text-emerald-600"><span>แพลตฟอร์มอุดหนุน</span><span>฿{formatCurrency(preview.grandTotalShippingShopeeSubsidy || 0)}</span></div>
                        <div className="flex justify-between text-red-500 font-medium border-t border-sky-200 pt-0.5"><span>ผู้ขายจ่ายเอง</span><span>฿{formatCurrency(preview.grandTotalShippingSellerPaid || 0)}</span></div>
                      </div>
                    </div>
                  </div>
                )}

                {hasDetailedFees && (preview.grandTotalShippingBuyerPaid || 0) > 0 && (
                  <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-sky-600" />
                      <span className="text-sm font-medium text-sky-800">รวมค่าขนส่ง (ที่ผู้ซื้อจ่าย) ในใบกำกับภาษี</span>
                      <span className="text-xs text-sky-500">฿{formatCurrency(preview.grandTotalShippingBuyerPaid || 0)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{includeShippingInTiv ? "รวม" : "ไม่รวม"}</span>
                      <Switch
                        checked={includeShippingInTiv}
                        onCheckedChange={setIncludeShippingInTiv}
                        data-testid="switch-include-shipping"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedOrders.size === preview.orders.length}
                      onCheckedChange={toggleAll}
                      data-testid="checkbox-select-all"
                    />
                    <span className="text-sm text-gray-600">เลือกทั้งหมด</span>
                  </div>
                  <Badge className="bg-blue-100 text-blue-700">
                    {hasDetailedFees ? "ใบกำกับภาษี (TIV) + ลงบัญชี" : "ใบกำกับภาษี (TIV)"}
                  </Badge>
                </div>

                <div className="border rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 sticky top-0 z-10">
                        <TableHead className="w-10"></TableHead>
                        <TableHead className="w-10"></TableHead>
                        <TableHead className="text-sm">เลขคำสั่งซื้อ</TableHead>
                        <TableHead className="text-sm">วันที่คำสั่งซื้อ</TableHead>
                        <TableHead className="text-sm">ลูกค้า</TableHead>
                        <TableHead className="text-sm">รายการ</TableHead>
                        <TableHead className="text-sm text-right">ยอดขาย</TableHead>
                        {hasDetailedFees && <TableHead className="text-sm text-right">ค่าธรรมเนียม</TableHead>}
                        {hasDetailedFees && <TableHead className="text-sm text-right">ค่าจัดส่งจริง</TableHead>}
                        {hasDetailedFees && <TableHead className="text-sm text-right">รายรับผู้ขาย</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.orders.slice(previewPage * PREVIEW_PAGE_SIZE, (previewPage + 1) * PREVIEW_PAGE_SIZE).map((order) => {
                        const isSelected = selectedOrders.has(order.orderNo);
                        const isExpanded = expandedOrders.has(order.orderNo);
                        const totalFees = (order.commission || 0) + (order.transactionFee || 0) + (order.serviceFee || 0);
                        const totalSales = order.subtotal + (order.shippingBuyerPaid || 0);
                        const sellerNetIncome = totalSales - totalFees - (order.shippingActualCost || 0) + (order.shippingShopeeSubsidy || 0);
                        const colSpan = hasDetailedFees ? 10 : 7;
                        return (
                          <>{/* Fragment */}
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
                              <TableCell className="text-sm font-mono text-xs">{order.orderNo}</TableCell>
                              <TableCell className="text-sm">{formatDate(order.orderDate || order.completedDate, dateEra, dateFmt)}</TableCell>
                              <TableCell className="text-sm max-w-[120px] truncate">{order.buyerName}</TableCell>
                              <TableCell className="text-sm">{order.items.length} รายการ</TableCell>
                              <TableCell className="text-sm text-right font-medium">฿{formatCurrency(order.subtotal + (order.shippingBuyerPaid || 0))}</TableCell>
                              {hasDetailedFees && <TableCell className="text-sm text-right text-amber-600">-฿{formatCurrency(totalFees)}</TableCell>}
                              {hasDetailedFees && <TableCell className="text-sm text-right text-red-600">{(order.shippingActualCost || 0) > 0 ? `-฿${formatCurrency(order.shippingActualCost || 0)}` : "-"}</TableCell>}
                              {hasDetailedFees && <TableCell className="text-sm text-right font-medium text-emerald-700">฿{formatCurrency(sellerNetIncome)}</TableCell>}
                            </TableRow>
                            {isExpanded && (
                              <TableRow key={`${order.orderNo}-detail`}>
                                <TableCell colSpan={colSpan} className="bg-gray-50/50 p-0">
                                  <div className="px-4 py-3">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-xs text-gray-500">
                                      {order.trackingNo && <div>พัสดุ: <span className="text-gray-700 font-mono">{order.trackingNo}</span></div>}
                                      {order.shippingProvider && <div>ขนส่ง: <span className="text-gray-700">{order.shippingProvider}</span></div>}
                                      {order.paymentMethod && <div>ชำระ: <span className="text-gray-700">{order.paymentMethod}</span></div>}
                                      {order.buyerPhone && <div>โทร: <span className="text-gray-700">{order.buyerPhone}</span></div>}
                                    </div>

                                    <table className="w-full text-xs mb-3">
                                      <thead>
                                        <tr className="border-b">
                                          <th className="text-left py-1 px-2">SKU</th>
                                          <th className="text-left py-1 px-2">ชื่อสินค้า</th>
                                          <th className="text-right py-1 px-2">จำนวน</th>
                                          <th className="text-right py-1 px-2">ราคาขายสุทธิ</th>
                                          {hasDetailedFees && <th className="text-right py-1 px-2">ส่วนลดผู้ขาย</th>}
                                          <th className="text-right py-1 px-2">ยอดผู้ขายได้รับ</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {order.items.map((item, idx) => (
                                          <tr key={idx} className="border-b border-gray-100">
                                            <td className="py-1 px-2 font-mono text-gray-500">{item.sku || "-"}</td>
                                            <td className="py-1 px-2 max-w-[200px] truncate">{item.productName}</td>
                                            <td className="py-1 px-2 text-right">{item.qty}</td>
                                            <td className="py-1 px-2 text-right">฿{formatCurrency(item.grossSellingPrice || (item.unitPrice * item.qty))}</td>
                                            {hasDetailedFees && (
                                              <td className="py-1 px-2 text-right text-red-500">
                                                {item.discount > 0 ? `-฿${formatCurrency(item.discount)}` : "-"}
                                              </td>
                                            )}
                                            <td className="py-1 px-2 text-right font-medium">฿{formatCurrency(item.totalPrice)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>

                                    {hasDetailedFees && (
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                        <div className="bg-white rounded p-2 border">
                                          <div className="text-gray-500 mb-1">ยอดผู้ขายได้รับ (รวม VAT)</div>
                                          <div>ยอดขาย (หลังหักส่วนลดผู้ขาย): ฿{formatCurrency(order.subtotal)}</div>
                                          {order.items.reduce((s, i) => s + (i.discount || 0), 0) > 0 && (
                                            <div className="text-red-500">ส่วนลดผู้ขายรวม: -฿{formatCurrency(order.items.reduce((s, i) => s + (i.discount || 0), 0))}</div>
                                          )}
                                          {(order.shippingBuyerPaid || 0) > 0 && (
                                            <div>ค่าจัดส่ง (ผู้ซื้อ): ฿{formatCurrency(order.shippingBuyerPaid || 0)}</div>
                                          )}
                                          <div className="border-t mt-1 pt-1 font-semibold">รวม: ฿{formatCurrency(order.subtotal + (order.shippingBuyerPaid || 0))}</div>
                                        </div>
                                        <div className="bg-white rounded p-2 border">
                                          <div className="text-gray-500 mb-1">ค่าธรรมเนียม</div>
                                          <div className="text-amber-600">Commission: ฿{formatCurrency(order.commission || 0)}</div>
                                          <div className="text-amber-600">Transaction Fee: ฿{formatCurrency(order.transactionFee || 0)}</div>
                                          <div className="text-amber-600">Service Fee: ฿{formatCurrency(order.serviceFee || 0)}</div>
                                          <div className="border-t mt-1 pt-1 font-semibold text-amber-700">รวม: ฿{formatCurrency(totalFees)}</div>
                                        </div>
                                        <div className="bg-white rounded p-2 border">
                                          <div className="text-gray-500 mb-1">ค่าขนส่ง</div>
                                          <div>ค่าจัดส่งจริง: ฿{formatCurrency(order.shippingActualCost || 0)}</div>
                                          <div className="text-cyan-600">Shopee อุดหนุน: ฿{formatCurrency(order.shippingShopeeSubsidy || 0)}</div>
                                          <div>ผู้ซื้อจ่าย: ฿{formatCurrency(order.shippingBuyerPaid || 0)}</div>
                                          {(() => {
                                            const diff = Math.max(0, (order.shippingActualCost || 0) - (order.shippingBuyerPaid || 0) - (order.shippingShopeeSubsidy || 0));
                                            return <div className="border-t mt-1 pt-1 font-semibold text-red-600">ส่วนต่างผู้ขายออก: {diff > 0 ? `฿${formatCurrency(diff)}` : "฿0.00"}</div>;
                                          })()}
                                        </div>
                                        <div className="bg-emerald-50 rounded p-2 border border-emerald-200">
                                          <div className="text-gray-500 mb-1">รายรับผู้ขาย</div>
                                          <div>ยอดขาย: ฿{formatCurrency(totalSales)}</div>
                                          <div className="text-amber-600">- ค่าธรรมเนียม: ฿{formatCurrency(totalFees)}</div>
                                          <div className="text-red-600">- ค่าจัดส่งจริง: ฿{formatCurrency(order.shippingActualCost || 0)}</div>
                                          {(order.shippingShopeeSubsidy || 0) > 0 && <div className="text-cyan-600">+ Shopee อุดหนุน: ฿{formatCurrency(order.shippingShopeeSubsidy || 0)}</div>}
                                          <div className="border-t mt-1 pt-1 font-semibold text-emerald-700">รายรับสุทธิ: ฿{formatCurrency(sellerNetIncome)}</div>
                                        </div>
                                      </div>
                                    )}

                                    {order.buyerAddress && (
                                      <div className="mt-2 text-xs text-gray-500">ที่อยู่: {order.buyerAddress}</div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {preview.orders.length > PREVIEW_PAGE_SIZE && (
                  <div className="flex items-center justify-between mt-2 px-2">
                    <span className="text-xs text-gray-500">
                      แสดง {previewPage * PREVIEW_PAGE_SIZE + 1}-{Math.min((previewPage + 1) * PREVIEW_PAGE_SIZE, preview.orders.length)} จาก {preview.orders.length} ออเดอร์
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-7 text-xs" disabled={previewPage === 0} onClick={() => setPreviewPage(p => p - 1)} data-testid="button-prev-page">ก่อนหน้า</Button>
                      <span className="text-xs px-2">{previewPage + 1}/{Math.ceil(preview.orders.length / PREVIEW_PAGE_SIZE)}</span>
                      <Button variant="outline" size="sm" className="h-7 text-xs" disabled={(previewPage + 1) * PREVIEW_PAGE_SIZE >= preview.orders.length} onClick={() => setPreviewPage(p => p + 1)} data-testid="button-next-page">ถัดไป</Button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-gray-600">
                    เลือก <span className="font-semibold text-[#05b187]">{selectedOrders.size}</span> จาก {preview.totalOrders} คำสั่งซื้อ
                    {" | "}ยอดรวม: <span className="font-semibold">
                      ฿{formatCurrency(preview.orders.filter(o => selectedOrders.has(o.orderNo)).reduce((s, o) => s + o.subtotal + (includeShippingInTiv ? (o.shippingBuyerPaid || 0) : 0), 0))}
                    </span>
                    {hasDetailedFees && (() => {
                      const sel = preview.orders.filter(o => selectedOrders.has(o.orderNo));
                      const totalFeesSum = sel.reduce((s, o) => s + (o.commission || 0) + (o.transactionFee || 0) + (o.serviceFee || 0), 0);
                      const totalShipCost = sel.reduce((s, o) => s + (o.shippingActualCost || 0), 0);
                      const totalSellerNet = sel.reduce((s, o) => {
                        const sales = o.subtotal + (o.shippingBuyerPaid || 0);
                        const fees = (o.commission || 0) + (o.transactionFee || 0) + (o.serviceFee || 0);
                        return s + sales - fees - (o.shippingActualCost || 0) + (o.shippingShopeeSubsidy || 0);
                      }, 0);
                      return (
                        <>
                        {" | "}ค่าธรรมเนียม: <span className="font-semibold text-amber-600">-฿{formatCurrency(totalFeesSum)}</span>
                        {" | "}ค่าจัดส่งจริง: <span className="font-semibold text-red-600">-฿{formatCurrency(totalShipCost)}</span>
                        {" | "}รายรับผู้ขาย: <span className="font-semibold text-emerald-700">฿{formatCurrency(totalSellerNet)}</span>
                        </>
                      );
                    })()}
                  </div>
                  <Button
                    onClick={handleStartVatCheck}
                    disabled={selectedOrders.size === 0 || createMutation.isPending || vatAnalyzing}
                    className="bg-[#05b187] hover:bg-[#049e79] text-white px-6"
                    data-testid="btn-create-documents"
                  >
                    {vatAnalyzing ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> AI กำลังวิเคราะห์ VAT...</>
                    ) : createMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" />
                        {chunkProgress && chunkProgress.total > 1
                          ? `กำลังสร้าง ชุดที่ ${chunkProgress.current}/${chunkProgress.total} (สำเร็จ ${chunkProgress.created})`
                          : "กำลังสร้าง..."
                        }
                      </>
                    ) : (
                      <><FileText className="h-4 w-4 mr-2" />
                        {hasDetailedFees
                          ? `นำเข้า + สร้าง TIV + ลงบัญชี (${selectedOrders.size})`
                          : `สร้างใบกำกับภาษี (${selectedOrders.size})`
                        }
                      </>
                    )}
                  </Button>
                </div>
                {chunkProgress && chunkProgress.total > 1 && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>ประมวลผลชุดที่ {chunkProgress.current} จาก {chunkProgress.total}</span>
                      <span>สำเร็จ {chunkProgress.created} | ข้ามไป {chunkProgress.skipped} | ผิดพลาด {chunkProgress.errors}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-[#05b187] h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${Math.round((chunkProgress.current / chunkProgress.total) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {step === "result" && createResult && (
          <div className="space-y-4">
            <Card className="flexy-card">
              <CardHeader className="pb-3">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-[#05b187]" />
                  ผลการนำเข้า
                  {createResult.batchId && <Badge className="bg-blue-100 text-blue-700 ml-2">Batch #{createResult.batchId}</Badge>}
                </h2>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-700" data-testid="text-created-count">{createResult.totalCreated}</div>
                    <div className="text-sm text-green-600">สร้างสำเร็จ</div>
                  </div>
                  {createResult.totalSkipped > 0 && (
                    <div className="bg-yellow-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-yellow-700" data-testid="text-skipped-count">{createResult.totalSkipped}</div>
                      <div className="text-sm text-yellow-600">ข้าม (นำเข้าแล้ว)</div>
                    </div>
                  )}
                  {createResult.totalErrors > 0 && (
                    <div className="bg-red-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-red-700" data-testid="text-error-count">{createResult.totalErrors}</div>
                      <div className="text-sm text-red-600">ข้อผิดพลาด</div>
                    </div>
                  )}
                  {createResult.productsCreated > 0 && (
                    <div className="bg-purple-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-purple-700" data-testid="text-products-created">{createResult.productsCreated}</div>
                      <div className="text-sm text-purple-600">สินค้าใหม่</div>
                    </div>
                  )}
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-700">{platformInfo?.label}</div>
                    <div className="text-sm text-blue-600">แพลตฟอร์ม</div>
                  </div>
                </div>

                {createResult.createdDocs?.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">เอกสารที่สร้างแล้ว:</h3>
                    <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 sticky top-0">
                            <TableHead className="text-sm">คำสั่งซื้อ</TableHead>
                            <TableHead className="text-sm">เลขที่เอกสาร</TableHead>
                            {hasDetailedFees && <TableHead className="text-sm">เลขที่บัญชี</TableHead>}
                            <TableHead className="text-sm text-right">ยอดรวม</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {createResult.createdDocs.map((doc: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="text-sm font-mono text-xs">{doc.orderNo}</TableCell>
                              <TableCell className="text-sm">
                                <Badge className="bg-blue-100 text-blue-700">{doc.docNo || doc.taxInvoiceNo}</Badge>
                              </TableCell>
                              {hasDetailedFees && doc.journalEntryNo && (
                                <TableCell className="text-sm">
                                  <Badge className="bg-green-100 text-green-700">{doc.journalEntryNo}</Badge>
                                </TableCell>
                              )}
                              <TableCell className="text-sm text-right font-medium">
                                {doc.totalAmount && `฿${formatCurrency(doc.totalAmount)}`}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {createResult.errors?.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-red-700 mb-2">ข้อผิดพลาด:</h3>
                    <div className="bg-red-50 rounded-lg p-3 space-y-1">
                      {createResult.errors.map((err: any, idx: number) => (
                        <div key={idx} className="text-xs text-red-700">
                          <span className="font-mono">{err.orderNo}</span>: {err.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
                  <Button variant="outline" onClick={resetAll} data-testid="btn-import-more">
                    <Upload className="h-4 w-4 mr-1" /> นำเข้าไฟล์ใหม่
                  </Button>
                  <Button variant="outline" onClick={() => setStep("history")} data-testid="btn-go-history">
                    <History className="h-4 w-4 mr-1" /> ดูประวัติการนำเข้า
                  </Button>
                  <Button className="bg-[#539BFF] hover:bg-[#4080e0] text-white" onClick={() => navigate("/sales/tax-invoice")} data-testid="btn-go-tax-invoices">
                    <FileText className="h-4 w-4 mr-1" /> ดูใบกำกับภาษี
                  </Button>
                  <Button className="bg-[#05b187] hover:bg-[#049e79] text-white" onClick={() => navigate("/journal")} data-testid="btn-go-journal">
                    <Receipt className="h-4 w-4 mr-1" /> ดูสมุดบัญชี
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/ecommerce/orders")} data-testid="btn-go-orders">
                    <ShoppingCart className="h-4 w-4 mr-1" /> ดูคำสั่งซื้อ
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        {step === "returns" && (
          <div className="space-y-4">
            <Card className="flexy-card">
              <CardHeader className="pb-3">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <RotateCcw className="h-5 w-5 text-[#f94d4d]" />
                  ออกใบลดหนี้ (คืนสินค้า/ยกเลิก)
                </h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 text-red-600 flex-shrink-0" />
                    <div className="text-red-800">
                      <p className="font-medium mb-1">วิธีใช้งาน</p>
                      <ul className="list-disc list-inside space-y-0.5 text-red-700 text-xs">
                        <li>นำเข้าเลขคำสั่งซื้อจากไฟล์ Excel หรือพิมพ์/วางเลขออเดอร์ด้านล่าง</li>
                        <li>ระบบจะค้นหาออเดอร์ที่มีใบกำกับภาษีแล้วอัตโนมัติ</li>
                        <li>ใบลดหนี้จะอ้างอิงใบกำกับภาษีเดิม และกลับรายการบัญชีให้อัตโนมัติ</li>
                        <li>ใบลดหนี้จะแสดงในรายงานภาษีขายเป็นรายการหัก</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">เลขคำสั่งซื้อ (Order No.)</label>
                    <div className="flex items-center gap-2">
                      {returnFileName && (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> {returnFileName}
                        </span>
                      )}
                      <input
                        ref={returnFileRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        onChange={handleReturnExcelUpload}
                        data-testid="input-return-excel"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-[#f94d4d] text-[#f94d4d] hover:bg-red-50 h-7 text-xs"
                        onClick={() => returnFileRef.current?.click()}
                        data-testid="btn-upload-return-excel"
                      >
                        <Upload className="h-3 w-3 mr-1" /> นำเข้าจาก Excel
                      </Button>
                    </div>
                  </div>
                  <textarea
                    className="w-full border rounded-lg p-3 text-sm font-mono min-h-[120px] focus:ring-2 focus:ring-[#f94d4d] focus:border-[#f94d4d]"
                    placeholder={"วางเลขคำสั่งซื้อที่นี่ (1 บรรทัดต่อ 1 ออเดอร์)\nหรือกดปุ่ม \"นำเข้าจาก Excel\" ด้านบน\nเช่น:\n2502010001\n2502010002"}
                    value={returnOrderNumbers}
                    onChange={(e) => setReturnOrderNumbers(e.target.value)}
                    data-testid="textarea-return-orders"
                  />
                  <p className="text-xs text-gray-400 mt-1">คั่นด้วย Enter, คอมม่า (,) หรือ อัฒภาค (;) • รองรับ .xlsx, .xls, .csv</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">เหตุผลในการออกใบลดหนี้</label>
                  <Select value={returnReason} onValueChange={setReturnReason}>
                    <SelectTrigger className="rounded-lg" data-testid="select-return-reason">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ลูกค้าขอคืนสินค้า/ยกเลิกคำสั่งซื้อ">ลูกค้าขอคืนสินค้า/ยกเลิกคำสั่งซื้อ</SelectItem>
                      <SelectItem value="ลูกค้าปฏิเสธรับสินค้า">ลูกค้าปฏิเสธรับสินค้า</SelectItem>
                      <SelectItem value="สินค้าชำรุด/เสียหาย">สินค้าชำรุด/เสียหาย</SelectItem>
                      <SelectItem value="ส่งสินค้าผิดรายการ">ส่งสินค้าผิดรายการ</SelectItem>
                      <SelectItem value="ส่วนลดหลังการขาย">ส่วนลดหลังการขาย</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => returnPreviewMutation.mutate()}
                    disabled={!returnOrderNumbers.trim() || returnPreviewMutation.isPending}
                    className="bg-[#f94d4d] hover:bg-[#e03c3c] text-white px-6"
                    data-testid="btn-preview-returns"
                  >
                    {returnPreviewMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> กำลังตรวจสอบ...</>
                    ) : (
                      <><Eye className="h-4 w-4 mr-2" /> ตรวจสอบออเดอร์</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === "returns_preview" && returnPreview && (
          <div className="space-y-4">
            <Card className="flexy-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Eye className="h-5 w-5 text-[#f94d4d]" />
                    ตรวจสอบรายการออกใบลดหนี้
                  </h2>
                  <Button variant="outline" size="sm" onClick={() => { setStep("returns"); setReturnPreview(null); }} data-testid="btn-back-returns">
                    <ArrowLeft className="h-4 w-4 mr-1" /> กลับ
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500">ออกใบลดหนี้ได้</div>
                    <div className="font-bold text-lg text-green-700" data-testid="text-return-eligible">{returnPreview.totalEligible}</div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500">ข้าม</div>
                    <div className="font-bold text-lg text-yellow-700" data-testid="text-return-skipped">{returnPreview.totalSkipped}</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500">ยอดใบลดหนี้รวม</div>
                    <div className="font-bold text-lg text-red-700" data-testid="text-return-total">
                      ฿{formatCurrency(returnPreview.orders.reduce((s: number, o: any) => s + o.totalAmount, 0))}
                    </div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500">เหตุผล</div>
                    <div className="font-semibold text-xs text-blue-700 truncate" data-testid="text-return-reason">{returnReason}</div>
                  </div>
                </div>

                {returnPreview.orders.length > 0 && (
                  <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto mb-4">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50 sticky top-0">
                          <TableHead className="text-sm">เลขคำสั่งซื้อ</TableHead>
                          <TableHead className="text-sm">แพลตฟอร์ม</TableHead>
                          <TableHead className="text-sm">ลูกค้า</TableHead>
                          <TableHead className="text-sm">เลขที่ใบกำกับภาษีเดิม</TableHead>
                          <TableHead className="text-sm">วันที่เอกสารเดิม</TableHead>
                          <TableHead className="text-sm text-right">ยอด</TableHead>
                          <TableHead className="text-sm text-right">VAT</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {returnPreview.orders.map((o: any) => (
                          <TableRow key={o.orderNo} data-testid={`row-return-${o.orderNo}`}>
                            <TableCell className="text-sm font-mono text-xs">{o.orderNo}</TableCell>
                            <TableCell className="text-sm">{o.platform}</TableCell>
                            <TableCell className="text-sm">{o.buyerName}</TableCell>
                            <TableCell className="text-sm">
                              <Badge className="bg-blue-100 text-blue-700">{o.taxInvoiceNo}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{formatDate(o.taxInvoiceDate, dateEra, dateFmt)}</TableCell>
                            <TableCell className="text-sm text-right font-medium text-red-600">฿{formatCurrency(o.totalAmount)}</TableCell>
                            <TableCell className="text-sm text-right text-red-500">฿{formatCurrency(o.vatAmount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {returnPreview.skipped?.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-yellow-700 mb-2">รายการที่ข้าม ({returnPreview.skipped.length}):</h3>
                    <div className="bg-yellow-50 rounded-lg p-3 space-y-1">
                      {returnPreview.skipped.map((s: any, idx: number) => (
                        <div key={idx} className="text-xs text-yellow-700">
                          <span className="font-mono">{s.orderNo}</span>: {s.reason}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-gray-600">
                    จะสร้างใบลดหนี้ <span className="font-semibold text-red-600">{returnPreview.totalEligible}</span> ใบ
                    {" | "}ยอดรวม: <span className="font-semibold text-red-600">
                      ฿{formatCurrency(returnPreview.orders.reduce((s: number, o: any) => s + o.totalAmount, 0))}
                    </span>
                  </div>
                  <Button
                    onClick={() => createReturnMutation.mutate()}
                    disabled={returnPreview.totalEligible === 0 || createReturnMutation.isPending}
                    className="bg-[#f94d4d] hover:bg-[#e03c3c] text-white px-6"
                    data-testid="btn-create-credit-notes"
                  >
                    {createReturnMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> กำลังสร้าง...</>
                    ) : (
                      <><FileText className="h-4 w-4 mr-2" /> สร้างใบลดหนี้ + ลงบัญชี ({returnPreview.totalEligible})</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === "returns_result" && returnResult && (
          <div className="space-y-4">
            <Card className="flexy-card">
              <CardHeader className="pb-3">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-[#05b187]" />
                  ผลการสร้างใบลดหนี้
                  {returnResult.batchId && <Badge className="bg-red-100 text-red-700 ml-2">Batch #{returnResult.batchId}</Badge>}
                </h2>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-700" data-testid="text-return-created">{returnResult.totalCreated}</div>
                    <div className="text-sm text-green-600">สร้างใบลดหนี้สำเร็จ</div>
                  </div>
                  {returnResult.totalSkipped > 0 && (
                    <div className="bg-yellow-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-yellow-700">{returnResult.totalSkipped}</div>
                      <div className="text-sm text-yellow-600">ข้าม</div>
                    </div>
                  )}
                  {returnResult.totalErrors > 0 && (
                    <div className="bg-red-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-red-700">{returnResult.totalErrors}</div>
                      <div className="text-sm text-red-600">ข้อผิดพลาด</div>
                    </div>
                  )}
                </div>

                {returnResult.createdDocs?.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">ใบลดหนี้ที่สร้างแล้ว:</h3>
                    <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 sticky top-0">
                            <TableHead className="text-sm">คำสั่งซื้อ</TableHead>
                            <TableHead className="text-sm">เลขที่ใบลดหนี้</TableHead>
                            <TableHead className="text-sm">อ้างอิง TIV เดิม</TableHead>
                            <TableHead className="text-sm">เลขที่บัญชี</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {returnResult.createdDocs.map((doc: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="text-sm font-mono text-xs">{doc.orderNo}</TableCell>
                              <TableCell className="text-sm">
                                <Badge className="bg-red-100 text-red-700">{doc.creditNoteNo}</Badge>
                              </TableCell>
                              <TableCell className="text-sm">
                                <Badge className="bg-blue-100 text-blue-700">{doc.refTaxInvoiceNo}</Badge>
                              </TableCell>
                              <TableCell className="text-sm">
                                {doc.journalEntryNo && <Badge className="bg-green-100 text-green-700">{doc.journalEntryNo}</Badge>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
                  <Button variant="outline" onClick={() => { setStep("returns"); setReturnPreview(null); setReturnResult(null); setReturnOrderNumbers(""); }} data-testid="btn-return-more">
                    <RotateCcw className="h-4 w-4 mr-1" /> ออกใบลดหนี้เพิ่ม
                  </Button>
                  <Button variant="outline" onClick={() => setStep("history")} data-testid="btn-return-go-history">
                    <History className="h-4 w-4 mr-1" /> ดูประวัติการนำเข้า
                  </Button>
                  <Button className="bg-[#539BFF] hover:bg-[#4080e0] text-white" onClick={() => navigate("/sales/credit-note")} data-testid="btn-go-credit-notes">
                    <FileText className="h-4 w-4 mr-1" /> ดูใบลดหนี้
                  </Button>
                  <Button className="bg-[#05b187] hover:bg-[#049e79] text-white" onClick={() => navigate("/journal")} data-testid="btn-return-go-journal">
                    <Receipt className="h-4 w-4 mr-1" /> ดูสมุดบัญชี
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={vatDialogOpen} onOpenChange={setVatDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#539BFF]">
              <Receipt className="h-5 w-5" />
              ยืนยันประเภท VAT สินค้า
            </DialogTitle>
            <DialogDescription>
              AI วิเคราะห์ประเภท VAT ของสินค้าแต่ละรายการแล้ว กรุณาตรวจสอบและแก้ไขก่อนสร้างเอกสาร
              <span className="block mt-1 text-xs">
                <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3 w-3" /> เคยยืนยันแล้ว</span>
                {" | "}
                <span className="inline-flex items-center gap-1 text-blue-600"><AlertCircle className="h-3 w-3" /> AI แนะนำ (กรุณาตรวจสอบ)</span>
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-sm w-[60%]">ชื่อสินค้า</TableHead>
                  <TableHead className="text-sm text-center">แหล่งที่มา</TableHead>
                  <TableHead className="text-sm text-center">ประเภท VAT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vatItems.map((item, idx) => (
                  <TableRow key={idx} className={item.source === "ai" ? "bg-blue-50/30" : ""} data-testid={`row-vat-item-${idx}`}>
                    <TableCell className="text-sm font-medium">{item.productName}</TableCell>
                    <TableCell className="text-center">
                      {item.source === "dictionary" ? (
                        <Badge className="bg-green-100 text-green-700 text-xs">เคยยืนยัน</Badge>
                      ) : item.source === "ai" ? (
                        <Badge className="bg-blue-100 text-blue-700 text-xs">AI แนะนำ</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-600 text-xs">ค่าเริ่มต้น</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Select
                        value={item.vatType}
                        onValueChange={(val) => {
                          const updated = [...vatItems];
                          updated[idx] = { ...updated[idx], vatType: val };
                          setVatItems(updated);
                        }}
                      >
                        <SelectTrigger className="w-[120px] mx-auto h-8 text-sm" data-testid={`select-vat-type-${idx}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vat7">VAT 7%</SelectItem>
                          <SelectItem value="vat0">ยกเว้น VAT</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-xs text-gray-500">
              VAT 7%: {vatItems.filter(v => v.vatType === "vat7").length} รายการ |
              ยกเว้น VAT: {vatItems.filter(v => v.vatType === "vat0").length} รายการ
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setVatDialogOpen(false)} data-testid="btn-vat-cancel">ยกเลิก</Button>
              <Button
                onClick={handleVatConfirm}
                className="bg-[#05b187] hover:bg-[#049e79] text-white"
                disabled={createMutation.isPending}
                data-testid="btn-vat-confirm"
              >
                {createMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-1" /> กำลังสร้าง...</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4 mr-1" /> ยืนยันและสร้างเอกสาร</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              ยืนยันการยกเลิกการนำเข้า
            </DialogTitle>
            <DialogDescription>
              การดำเนินการนี้จะลบข้อมูลทั้งหมดที่สร้างจากการนำเข้าครั้งนี้ รวมถึง:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>คำสั่งซื้อ (Orders)</li>
                <li>ใบกำกับภาษี (Tax Invoices)</li>
                <li>บันทึกบัญชี (Journal Entries)</li>
              </ul>
              <p className="mt-2 font-medium text-red-600">การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>ยกเลิก</Button>
            <Button
              variant="destructive"
              disabled={deleteBatchMutation.isPending}
              onClick={() => deletingBatchId && deleteBatchMutation.mutate(deletingBatchId)}
              data-testid="btn-confirm-delete-batch"
            >
              {deleteBatchMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1" /> กำลังลบ...</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-1" /> ยืนยันลบทั้งหมด</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EcommerceLayout>
  );
}
