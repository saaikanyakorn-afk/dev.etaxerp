import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Plus, Package, Pencil, Trash2, Upload, FileDown, CheckCircle2, XCircle, AlertCircle, ClipboardList, RefreshCw, Barcode, Send } from "lucide-react";
import ListExportButton from "@/components/list-export-button";
import ListPdfExportButton from "@/components/list-pdf-export-button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useShowMore } from "@/hooks/use-show-more";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import type { Product } from "@shared/schema";
import ImportBatchHistory from "@/components/import-batch-history";

const CATEGORIES = [
  { value: "product", label: "สินค้า" },
  { value: "service", label: "บริการ" },
  { value: "raw_material", label: "วัตถุดิบ" },
  { value: "consumable", label: "วัสดุสิ้นเปลือง" },
];

export default function InventoryList(props: { Wrapper?: React.ComponentType<{ children: React.ReactNode }>; basePath?: string } & Record<string, any>) {
  const LayoutComponent = props.Wrapper || Layout;
  const basePath = props.basePath || "/inventory";
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importStep, setImportStep] = useState<"upload" | "preview" | "done">("upload");
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [updateDuplicates, setUpdateDuplicates] = useState(false);
  const [costUpdateLogs, setCostUpdateLogs] = useState<any[]>([]);
  const [showCostLogs, setShowCostLogs] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/products?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/products/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "ลบสินค้าสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const bulkBarcodeMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/products/bulk-generate-barcodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: `สร้างบาร์โค้ดสำเร็จ ${data.generated} รายการ` });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const withoutBarcode = products.filter(p => p.active && !p.barcode).length;

  const filtered = products
    .filter(p => p.active)
    .filter(p => categoryFilter === "all" || p.category === categoryFilter)
    .filter(p => {
      if (!search) return true;
      const s = search.toLowerCase();
      return p.name.toLowerCase().includes(s) || p.code.toLowerCase().includes(s) || (p.description || "").toLowerCase().includes(s);
    });

  const { visibleItems, hasMore, remainingCount, totalCount, showMore } = useShowMore(filtered);

  const activeProducts = products.filter(p => p.active);
  const stats = {
    total: activeProducts.length,
    product: activeProducts.filter(p => p.category === "product").length,
    service: activeProducts.filter(p => p.category === "service").length,
    other: activeProducts.filter(p => p.category !== "product" && p.category !== "service").length,
  };

  const categoryLabel = (c: string) => CATEGORIES.find(cat => cat.value === c)?.label || c;
  const categoryBadge = (c: string) => {
    const colors: Record<string, string> = {
      product: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
      service: "bg-[#fffcf0] text-[#fec90f] hover:bg-[#fffcf0]",
      raw_material: "bg-amber-100 text-amber-700 hover:bg-amber-100",
      consumable: "bg-gray-100 text-gray-700 hover:bg-gray-100",
    };
    return <Badge data-testid={`badge-category-${c}`} className={colors[c] || ""}>{categoryLabel(c)}</Badge>;
  };

  const formatNumber = (val: string | null) => {
    const n = Number(val || 0);
    return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

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
      setImportStep("preview");
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
      const dupItems = updateDuplicates ? importPreview.preview.filter((p: any) => p.status === "duplicate" && p.data.code).map((p: any) => p.data) : [];
      const r = await fetch("/api/products/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ companyId: selectedCompanyId, products: okItems, updateProducts: dupItems }),
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.message); }
      const result = await r.json();
      setImportResult(result);
      setImportStep("done");
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    } catch (err: any) {
      toast({ title: "นำเข้าไม่สำเร็จ", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  function resetImport() {
    setImportStep("upload");
    setImportPreview(null);
    setImportResult(null);
    setImportDialogOpen(false);
    setUpdateDuplicates(false);
  }

  const handleUpdateCostJournals = async () => {
    if (!selectedCompanyId) return;
    try {
      const res = await apiRequest("POST", "/api/inventory/update-cost-journals", { companyId: selectedCompanyId });
      const data = await res.json();
      if (data.logs) {
        setCostUpdateLogs(data.logs);
        setShowCostLogs(true);
      }
      toast({ title: "อัพเดทต้นทุนบัญชีสำเร็จ", description: `ปรับปรุง ${data.logs?.filter((l: any) => l.status === "updated").length || 0} รายการ`, variant: "success" as any });
    } catch (err: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    }
  };


  return (
    <LayoutComponent>
      <div className="space-y-4 w-full overflow-x-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <Package className="h-5 w-5 text-primary" />
            <h1 data-testid="text-page-title" className="text-xl font-heading font-bold">สรุปรายการสินค้า/บริการ</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
          <Button data-testid="button-update-cost" variant="outline" className="gap-2" onClick={handleUpdateCostJournals}>
            <RefreshCw className="h-4 w-4" /> อัพเดทต้นทุนบัญชี
          </Button>
          <ListPdfExportButton
            data={filtered}
            columns={[
              { header: "รหัส", key: "code", width: "60px" },
              { header: "ชื่อสินค้า/บริการ", key: "name", width: "auto" },
              { header: "หมวดหมู่", key: "category", width: "70px", align: "center" },
              { header: "หน่วย", key: "unit", width: "50px", align: "center" },
              { header: "ราคาขาย", key: "price", width: "80px", align: "right", format: "number" },
              { header: "ต้นทุน", key: "cost", width: "80px", align: "right", format: "number" },
              { header: "คงเหลือ", key: "quantity", width: "60px", align: "right", format: "number" },
            ]}
            title="รายการสินค้า/บริการ"
            subtitle={`ทั้งหมด ${filtered.length} รายการ`}
          />
          <ListExportButton
            data={filtered}
            columns={[
              { header: "รหัส", key: "code", width: 15 },
              { header: "ชื่อสินค้า/บริการ", key: "name", width: 35 },
              { header: "หมวดหมู่", key: "category", width: 12 },
              { header: "หน่วย", key: "unit", width: 10 },
              { header: "ราคาขาย", key: "price", width: 12, format: "number" },
              { header: "ต้นทุน", key: "cost", width: 12, format: "number" },
              { header: "คงเหลือ", key: "quantity", width: 10, format: "number" },
              { header: "VAT", key: "vatType", width: 10 },
              { header: "บาร์โค้ด", key: "barcode", width: 18 },
            ]}
            fileName="รายการสินค้า"
            sheetName="สินค้า"
          />
          <Button data-testid="btn-stock-transfer" variant="outline" className="gap-2 border-[#fb9678] text-[#fb9678]"
            onClick={() => navigate("/inventory/stock-transfer")}>
            <Send className="h-4 w-4" /> กระจายสินค้าไปสาขา
          </Button>
          {withoutBarcode > 0 && (
            <Button data-testid="btn-bulk-barcode" variant="outline" className="gap-2 border-[#03c9d7] text-[#03c9d7]"
              onClick={() => bulkBarcodeMutation.mutate()} disabled={bulkBarcodeMutation.isPending}>
              <Barcode className="h-4 w-4" />
              {bulkBarcodeMutation.isPending ? "กำลังสร้าง..." : `สร้างบาร์โค้ด (${withoutBarcode})`}
            </Button>
          )}
          <Dialog open={importDialogOpen} onOpenChange={(open) => { if (!open) resetImport(); setImportDialogOpen(open); }}>
            <DialogTrigger asChild>
              <Button data-testid="button-import" variant="outline" className="gap-2">
                <Upload className="h-4 w-4" /> นำเข้า
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>นำเข้าสินค้า/บริการ</DialogTitle>
              </DialogHeader>

              {importStep === "upload" && (
                <div className="space-y-4 py-2">
                  <div className="rounded-lg border-2 border-dashed p-8 text-center">
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm font-medium mb-1">อัปโหลดไฟล์ Excel หรือ CSV</p>
                    <p className="text-xs text-muted-foreground mb-4">รองรับ .xlsx, .xls, .csv (สูงสุด 1,000 รายการ)</p>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
                    <div className="flex items-center justify-center gap-3">
                      <Button data-testid="button-select-file" onClick={() => fileInputRef.current?.click()}>เลือกไฟล์</Button>
                      <Button data-testid="button-download-template" variant="outline" className="gap-2" onClick={() => {
                        window.open("/api/products/import/template", "_blank");
                      }}>
                        <FileDown className="h-4 w-4" /> ดาวน์โหลดแบบฟอร์ม
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p className="font-medium">คอลัมน์ในไฟล์:</p>
                    <p>รหัสสินค้า, ชื่อสินค้า, ชื่ออังกฤษ, ชื่อจีน, หมวดหมู่ (สินค้า/บริการ/วัตถุดิบ/วัสดุสิ้นเปลือง), รายละเอียด, หน่วย, ราคาขาย, ต้นทุน, รวมVAT (รวม/ไม่รวม), รหัสบัญชี</p>
                  </div>
                </div>
              )}

              {importStep === "preview" && importPreview && (
                <div className="space-y-4 py-2">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>พร้อมนำเข้า: <strong>{importPreview.stats.ok}</strong></span>
                    </div>
                    {importPreview.stats.duplicate > 0 && (
                      <div className="flex items-center gap-2 text-sm text-amber-600">
                        <AlertCircle className="h-4 w-4" />
                        <span>ซ้ำ: <strong>{importPreview.stats.duplicate}</strong></span>
                      </div>
                    )}
                    {importPreview.stats.error > 0 && (
                      <div className="flex items-center gap-2 text-sm text-red-600">
                        <XCircle className="h-4 w-4" />
                        <span>ข้อผิดพลาด: <strong>{importPreview.stats.error}</strong></span>
                      </div>
                    )}
                  </div>
                  <div className="max-h-[400px] overflow-y-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead className="w-16">สถานะ</TableHead>
                          <TableHead className="w-20">รหัส</TableHead>
                          <TableHead>ชื่อสินค้า</TableHead>
                          <TableHead className="w-20">หมวดหมู่</TableHead>
                          <TableHead className="w-20 text-right">ราคา</TableHead>
                          <TableHead>หมายเหตุ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importPreview.preview.map((item: any) => (
                          <TableRow key={item.row} className={item.status === "ok" ? "" : item.status === "duplicate" ? "bg-amber-50" : "bg-red-50"}>
                            <TableCell className="text-xs">{item.row}</TableCell>
                            <TableCell>
                              {item.status === "ok" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
                               item.status === "duplicate" ? <AlertCircle className="h-4 w-4 text-amber-600" /> :
                               <XCircle className="h-4 w-4 text-red-600" />}
                            </TableCell>
                            <TableCell className="text-xs">{item.data.code || "-"}</TableCell>
                            <TableCell className="text-sm">{item.data.name || "-"}</TableCell>
                            <TableCell className="text-xs">{categoryLabel(item.data.category)}</TableCell>
                            <TableCell className="text-right text-xs">{item.data.price}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{item.issues.join(", ")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {importPreview.stats.duplicate > 0 && (
                    <label className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg bg-amber-50 border border-amber-200">
                      <input type="checkbox" checked={updateDuplicates} onChange={(e) => setUpdateDuplicates(e.target.checked)} className="rounded" data-testid="checkbox-update-duplicates" />
                      <span>อัพเดทสินค้าที่รหัสซ้ำ ({importPreview.stats.duplicate} รายการ) — แทนที่ชื่อ, ราคา, ต้นทุน ด้วยข้อมูลจากไฟล์</span>
                    </label>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button data-testid="button-import-cancel" variant="outline" onClick={resetImport}>ยกเลิก</Button>
                    <Button data-testid="button-import-execute" onClick={handleImportExecute} disabled={importing || (importPreview.stats.ok === 0 && !updateDuplicates)}>
                      {importing ? "กำลังนำเข้า..." : `นำเข้า ${importPreview.stats.ok + (updateDuplicates ? importPreview.stats.duplicate : 0)} รายการ`}
                    </Button>
                  </div>
                </div>
              )}

              {importStep === "done" && importResult && (
                <div className="space-y-4 py-4 text-center">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-600" />
                  <div>
                    <p className="text-lg font-medium">นำเข้าเรียบร้อย</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {importResult.imported > 0 && `สร้างใหม่ ${importResult.imported} รายการ`}
                      {importResult.updated > 0 && ` อัพเดท ${importResult.updated} รายการ`}
                      {importResult.skipped > 0 && ` (ข้าม ${importResult.skipped} รายการ)`}
                    </p>
                  </div>
                  <Button data-testid="button-import-close" onClick={resetImport}>ปิด</Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
          <Button data-testid="button-add-product" className="gap-2" onClick={() => navigate("/inventory/list/new")}>
            <Plus className="h-4 w-4" /> เพิ่มสินค้า/บริการ
          </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div data-testid="text-stat-total" className="text-2xl font-bold text-primary">{stats.total}</div>
              <div className="text-xs text-muted-foreground">รายการทั้งหมด</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div data-testid="text-stat-products" className="text-2xl font-bold" style={{ color: "#03c9d7" }}>{stats.product}</div>
              <div className="text-xs text-muted-foreground">สินค้า</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div data-testid="text-stat-services" className="text-2xl font-bold" style={{ color: "#03c9d7" }}>{stats.service}</div>
              <div className="text-xs text-muted-foreground">บริการ</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div data-testid="text-stat-other" className="text-2xl font-bold text-amber-600">{stats.other}</div>
              <div className="text-xs text-muted-foreground">วัตถุดิบ/วัสดุ</div>
            </CardContent>
          </Card>
        </div>

        <ImportBatchHistory docType="product" invalidateKeys={[["products"], ["/api/products"]]} />

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <Tabs value={categoryFilter} onValueChange={setCategoryFilter}>
                <TabsList className="flex-wrap h-auto">
                  <TabsTrigger data-testid="tab-all" value="all">ทั้งหมด ({stats.total})</TabsTrigger>
                  <TabsTrigger data-testid="tab-product" value="product">สินค้า ({stats.product})</TabsTrigger>
                  <TabsTrigger data-testid="tab-service" value="service">บริการ ({stats.service})</TabsTrigger>
                  <TabsTrigger data-testid="tab-raw" value="raw_material">วัตถุดิบ</TabsTrigger>
                  <TabsTrigger data-testid="tab-consumable" value="consumable">วัสดุสิ้นเปลือง</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="relative w-full sm:w-64 shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input data-testid="input-search" className="pl-9" placeholder="ค้นหาชื่อ, รหัส..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">รหัส</TableHead>
                  <TableHead>ชื่อสินค้า/บริการ</TableHead>
                  <TableHead className="w-28">หมวดหมู่</TableHead>
                  <TableHead className="w-20">หน่วย</TableHead>
                  <TableHead className="text-right w-28">ราคาขาย</TableHead>
                  <TableHead className="text-right w-28">ต้นทุน</TableHead>
                  <TableHead className="text-right w-24">คงเหลือ</TableHead>
                  <TableHead className="w-16 text-center">VAT</TableHead>
                  <TableHead className="w-28 text-center">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">กำลังโหลด...</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {activeProducts.length === 0 ? "ยังไม่มีข้อมูลสินค้า กด \"เพิ่มสินค้า/บริการ\" เพื่อเริ่มต้น" : "ไม่พบข้อมูลที่ค้นหา"}
                    </TableCell>
                  </TableRow>
                ) : visibleItems.map(product => (
                  <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                    <TableCell className="text-sm">{product.code}</TableCell>
                    <TableCell>
                      <div className="font-medium">{product.name}</div>
                      {product.nameEn && <div className="text-xs text-muted-foreground">{product.nameEn}</div>}
                      {product.barcode && <div className="text-xs text-muted-foreground flex items-center gap-1"><Barcode className="h-3 w-3" />{product.barcode}</div>}
                      {product.description && <div className="text-xs text-muted-foreground truncate max-w-xs">{product.description}</div>}
                    </TableCell>
                    <TableCell>{categoryBadge(product.category)}</TableCell>
                    <TableCell className="text-sm">{product.unit}</TableCell>
                    <TableCell className="text-right text-sm">
                      <div>{formatNumber(product.price)}</div>
                      {(() => {
                        const p = product as any;
                        const levels = [
                          { label: "ปลีก", val: p.priceRetail },
                          { label: "ส่ง", val: p.priceWholesale },
                          { label: "ตัวแทน", val: p.priceAgent },
                          { label: "พิเศษ", val: p.priceSpecial },
                          { label: "VIP", val: p.priceVip },
                        ].filter(l => parseFloat(String(l.val || "0")) > 0);
                        if (levels.length === 0) return null;
                        return (
                          <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                            {levels.map(l => `${l.label}: ${formatNumber(l.val)}`).join(" | ")}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{formatNumber(product.cost)}</TableCell>
                    <TableCell className={`text-right text-sm font-medium ${parseFloat(String(product.quantity || "0")) < 0 ? "text-red-600" : parseFloat(String(product.quantity || "0")) === 0 ? "text-muted-foreground" : "text-blue-700"}`} data-testid={`text-qty-${product.id}`}>
                      {formatNumber(parseFloat(String(product.quantity || "0")), 2)}
                    </TableCell>
                    <TableCell className="text-center">
                      {(() => {
                        const vt = (product as any).vatType || "vat7";
                        if (vt === "non_vat") return <Badge data-testid={`badge-vat-${product.id}`} className="bg-gray-100 text-gray-600 hover:bg-gray-100 text-[10px]">ไม่มี VAT</Badge>;
                        if (vt === "zero_rated") return <Badge data-testid={`badge-vat-${product.id}`} className="bg-[#fffcf0] text-[#fec90f] hover:bg-[#fffcf0] text-[10px]">VAT 0%</Badge>;
                        return <Badge data-testid={`badge-vat-${product.id}`} className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px]">{product.vatIncluded ? "7% รวม" : "7%"}</Badge>;
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button data-testid={`button-stockcard-${product.id}`} variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:text-blue-700" title="สต๊อกการ์ด" onClick={() => navigate(`${basePath}/stock-card?productId=${product.id}`)}>
                          <ClipboardList className="h-3.5 w-3.5" />
                        </Button>
                        <Button data-testid={`button-edit-${product.id}`} variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/inventory/list/edit/${product.id}`)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button data-testid={`button-delete-${product.id}`} variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => {
                          if (confirm("ต้องการลบสินค้านี้?")) deleteMutation.mutate(product.id);
                        }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {hasMore && (
              <div className="text-center py-3 border-t">
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); showMore(); }} className="text-sm font-medium hover:opacity-80 hover:underline cursor-pointer py-1 px-3" style={{ color: "var(--theme-primary)" }} data-testid="button-show-more">
                  แสดงเพิ่มเติม ({remainingCount} รายการ)
                </button>
              </div>
            )}
            {!hasMore && totalCount > 50 && (
              <div className="text-center py-2 text-xs text-muted-foreground">
                แสดงทั้งหมด {totalCount} รายการ
              </div>
            )}
          </CardContent>
        </Card>
        {showCostLogs && costUpdateLogs.length > 0 && (
          <Dialog open={showCostLogs} onOpenChange={setShowCostLogs}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>ผลการอัพเดทต้นทุนบัญชี</DialogTitle>
              </DialogHeader>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">เลขที่</TableHead>
                      <TableHead className="w-28">ประเภทเอกสาร</TableHead>
                      <TableHead className="text-right w-28">จำนวนเดิม</TableHead>
                      <TableHead className="text-center w-12">→</TableHead>
                      <TableHead className="text-right w-28">จำนวนใหม่</TableHead>
                      <TableHead className="w-24 text-center">สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costUpdateLogs.map((log: any, i: number) => (
                      <TableRow key={i} className={log.status === "updated" ? "bg-green-50" : ""}>
                        <TableCell className="text-sm">{log.entryNo || "-"}</TableCell>
                        <TableCell className="text-sm">{log.sourceDocType || "-"}</TableCell>
                        <TableCell className="text-right text-sm">{log.oldAmount != null ? Number(log.oldAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "-"}</TableCell>
                        <TableCell className="text-center text-muted-foreground">→</TableCell>
                        <TableCell className="text-right text-sm">{log.newAmount != null ? Number(log.newAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "-"}</TableCell>
                        <TableCell className="text-center">
                          {log.status === "updated" ? (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">อัพเดท</Badge>
                          ) : log.status === "skipped" ? (
                            <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">ข้าม</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-600 hover:bg-red-100">ผิดพลาด</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end">
                <Button data-testid="button-close-cost-logs" onClick={() => setShowCostLogs(false)}>ปิด</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </LayoutComponent>
  );
}