import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, FileDown, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import ImportBatchHistory from "@/components/import-batch-history";
import { useLocation } from "wouter";
import type { Product } from "@shared/schema";

const CATEGORIES = [
  { value: "product", label: "สินค้า" },
  { value: "service", label: "บริการ" },
  { value: "raw_material", label: "วัตถุดิบ" },
  { value: "consumable", label: "วัสดุสิ้นเปลือง" },
];

export default function ProductImportExport(props: { Wrapper?: React.ComponentType<{ children: React.ReactNode }> } & Record<string, any>) {
  const LayoutComponent = props.Wrapper || Layout;
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"menu" | "preview" | "done">("menu");
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/products?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const activeProducts = products.filter(p => p.active);
  const categoryLabel = (c: string) => CATEGORIES.find(cat => cat.value === c)?.label || c;

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("companyId", String(selectedCompanyId));
    try {
      const r = await fetch("/api/products/import/preview", { method: "POST", credentials: "include", body: formData });
      if (!r.ok) { const err = await r.json(); throw new Error(err.message); }
      const data = await r.json();
      setImportPreview(data);
      setStep("preview");
    } catch (err: any) {
      toast({ title: "อ่านไฟล์ไม่สำเร็จ", description: err.message, variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleImportExecute() {
    if (!importPreview) return;
    setImporting(true);
    try {
      const okItems = importPreview.preview.filter((p: any) => p.status === "ok").map((p: any) => p.data);
      const r = await fetch("/api/products/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ companyId: selectedCompanyId, products: okItems }),
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.message); }
      const result = await r.json();
      setImportResult(result);
      setStep("done");
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    } catch (err: any) {
      toast({ title: "นำเข้าไม่สำเร็จ", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  function resetImport() {
    setStep("menu");
    setImportPreview(null);
    setImportResult(null);
  }

  async function handleExport() {
    try {
      const r = await fetch(`/api/products/export?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) throw new Error("ส่งออกไม่สำเร็จ");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "products_export.xlsx"; a.click();
      URL.revokeObjectURL(url);
      toast({ title: "ส่งออกไฟล์ Excel เรียบร้อย" });
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    }
  }

  return (
    <LayoutComponent>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          <h1 data-testid="text-page-title" className="text-xl font-heading font-bold">นำเข้า/ส่งออก Excel สินค้า</h1>
        </div>

        <ImportBatchHistory docType="product" invalidateKeys={[["products"], ["/api/products"]]} />

        {step === "menu" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-2 hover:border-primary/40 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-green-50">
                    <Download className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h2 data-testid="text-export-title" className="text-lg font-bold">ส่งออก Excel</h2>
                    <p className="text-sm text-muted-foreground">ดาวน์โหลดรายการสินค้าทั้งหมดเป็นไฟล์ Excel</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">จำนวนสินค้าทั้งหมด</span>
                    <Badge data-testid="text-product-count" variant="secondary">{activeProducts.length} รายการ</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">สินค้า</span>
                    <span>{activeProducts.filter(p => p.category === "product").length} รายการ</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">บริการ</span>
                    <span>{activeProducts.filter(p => p.category === "service").length} รายการ</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">วัตถุดิบ/วัสดุ</span>
                    <span>{activeProducts.filter(p => p.category !== "product" && p.category !== "service").length} รายการ</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  คอลัมน์ที่ส่งออก: รหัสสินค้า, ชื่อสินค้า, ชื่ออังกฤษ, ชื่อจีน, หมวดหมู่, รายละเอียด, หน่วย, ราคาขาย, ต้นทุน, VAT, บาร์โค้ด, รหัสบัญชี
                </div>
                <Button data-testid="button-export" className="w-full gap-2" onClick={handleExport} disabled={activeProducts.length === 0}>
                  <Download className="h-4 w-4" /> ส่งออกไฟล์ Excel
                </Button>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/40 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-blue-50">
                    <Upload className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 data-testid="text-import-title" className="text-lg font-bold">นำเข้า Excel</h2>
                    <p className="text-sm text-muted-foreground">อัปโหลดไฟล์ Excel/CSV เพื่อเพิ่มสินค้าจำนวนมาก</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border-2 border-dashed p-6 text-center">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium mb-1">อัปโหลดไฟล์ Excel หรือ CSV</p>
                  <p className="text-xs text-muted-foreground mb-3">รองรับ .xlsx, .xls, .csv (สูงสุด 1,000 รายการ)</p>
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} data-testid="input-file" />
                  <Button data-testid="button-select-file" onClick={() => fileInputRef.current?.click()} className="gap-2">
                    <Upload className="h-4 w-4" /> เลือกไฟล์
                  </Button>
                </div>
                <Button data-testid="button-download-template" variant="outline" className="w-full gap-2" onClick={() => {
                  window.open("/api/products/import/template", "_blank");
                }}>
                  <FileDown className="h-4 w-4" /> ดาวน์โหลดแบบฟอร์ม (Template)
                </Button>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium">คอลัมน์ในไฟล์:</p>
                  <p>รหัสสินค้า, ชื่อสินค้า, ชื่ออังกฤษ, ชื่อจีน, หมวดหมู่, รายละเอียด, หน่วย, ราคาขาย, ต้นทุน, รวมVAT, รหัสบัญชี</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === "preview" && importPreview && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button data-testid="button-back" variant="ghost" size="icon" className="h-8 w-8" onClick={resetImport}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <h2 className="text-lg font-bold">ตรวจสอบข้อมูลก่อนนำเข้า</h2>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>พร้อมนำเข้า: <strong data-testid="text-ok-count">{importPreview.stats.ok}</strong></span>
                  </div>
                  {importPreview.stats.duplicate > 0 && (
                    <div className="flex items-center gap-2 text-sm text-amber-600">
                      <AlertCircle className="h-4 w-4" />
                      <span>ซ้ำ: <strong data-testid="text-dup-count">{importPreview.stats.duplicate}</strong></span>
                    </div>
                  )}
                  {importPreview.stats.error > 0 && (
                    <div className="flex items-center gap-2 text-sm text-red-600">
                      <XCircle className="h-4 w-4" />
                      <span>ข้อผิดพลาด: <strong data-testid="text-error-count">{importPreview.stats.error}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead className="w-16">สถานะ</TableHead>
                      <TableHead className="w-24">รหัส</TableHead>
                      <TableHead>ชื่อสินค้า</TableHead>
                      <TableHead className="w-24">หมวดหมู่</TableHead>
                      <TableHead className="w-20">หน่วย</TableHead>
                      <TableHead className="w-24 text-right">ราคา</TableHead>
                      <TableHead>หมายเหตุ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreview.preview.map((item: any) => (
                      <TableRow key={item.row} data-testid={`row-preview-${item.row}`} className={item.status === "ok" ? "" : item.status === "duplicate" ? "bg-amber-50" : "bg-red-50"}>
                        <TableCell className="text-xs">{item.row}</TableCell>
                        <TableCell>
                          {item.status === "ok" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
                           item.status === "duplicate" ? <AlertCircle className="h-4 w-4 text-amber-600" /> :
                           <XCircle className="h-4 w-4 text-red-600" />}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{item.data.code || "-"}</TableCell>
                        <TableCell className="text-sm">{item.data.name || "-"}</TableCell>
                        <TableCell className="text-xs">{categoryLabel(item.data.category)}</TableCell>
                        <TableCell className="text-xs">{item.data.unit || "-"}</TableCell>
                        <TableCell className="text-right text-xs">{item.data.price}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.issues.join(", ")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end gap-2 p-4 border-t">
                <Button data-testid="button-import-cancel" variant="outline" onClick={resetImport}>ยกเลิก</Button>
                <Button data-testid="button-import-execute" onClick={handleImportExecute} disabled={importing || importPreview.stats.ok === 0}>
                  {importing ? "กำลังนำเข้า..." : `นำเข้า ${importPreview.stats.ok} รายการ`}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "done" && importResult && (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 mx-auto text-green-600" />
              <div>
                <p className="text-xl font-bold">นำเข้าสำเร็จ!</p>
                <p className="text-sm text-muted-foreground mt-2">
                  นำเข้าสำเร็จ {importResult.imported} รายการ
                  {importResult.skipped > 0 && ` (ข้าม ${importResult.skipped} รายการ)`}
                </p>
              </div>
              <div className="flex justify-center gap-3">
                <Button data-testid="button-import-more" variant="outline" onClick={resetImport}>นำเข้าเพิ่ม</Button>
                <Button data-testid="button-go-products" onClick={() => navigate("/inventory/list")}>ดูรายการสินค้า</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </LayoutComponent>
  );
}
