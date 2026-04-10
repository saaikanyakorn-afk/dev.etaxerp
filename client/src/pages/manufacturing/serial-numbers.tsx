import ManufacturingLayout from "@/components/manufacturing-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Barcode, Loader2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompanyContext } from "@/lib/company-context";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  available: { label: "พร้อมใช้", color: "bg-green-100 text-green-700" },
  assembled: { label: "ประกอบแล้ว", color: "bg-blue-100 text-blue-700" },
  finished_good: { label: "สินค้า FG", color: "bg-purple-100 text-purple-700" },
  scrapped: { label: "ตัดทิ้ง", color: "bg-red-100 text-red-700" },
};

export default function SerialNumbersPage() {
  const { selectedCompany } = useCompanyContext();
  const companyId = selectedCompany?.id;
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [form, setForm] = useState({ productId: "", serialNumber: "", warehouseId: "", notes: "" });
  const [batchForm, setBatchForm] = useState({ productId: "", prefix: "", startNo: "1", count: "10", warehouseId: "" });

  const { data: serials, isLoading } = useQuery({
    queryKey: ["/api/manufacturing-module/serial-numbers", companyId, search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/manufacturing-module/serial-numbers?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!companyId,
  });

  const { data: productList } = useQuery({
    queryKey: ["/api/products-simple", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/products?companyId=${companyId}&limit=500`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      return data.products || data;
    },
    enabled: !!companyId,
  });

  const { data: warehouseList } = useQuery({
    queryKey: ["/api/warehouses-simple", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/warehouses?companyId=${companyId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!companyId,
  });

  const createMut = useMutation({
    mutationFn: async (body: any) => {
      const res = await fetch("/api/manufacturing-module/serial-numbers", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "สร้าง Serial สำเร็จ" });
      qc.invalidateQueries({ queryKey: ["/api/manufacturing-module/serial-numbers"] });
      setDialogOpen(false);
    },
    onError: (err: any) => toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const batchMut = useMutation({
    mutationFn: async (body: any) => {
      const res = await fetch("/api/manufacturing-module/serial-numbers/batch", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `สร้าง Serial สำเร็จ ${data.created} รายการ` });
      qc.invalidateQueries({ queryKey: ["/api/manufacturing-module/serial-numbers"] });
      setDialogOpen(false);
    },
    onError: (err: any) => toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  return (
    <ManufacturingLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Barcode className="w-6 h-6" style={{ color: "#03c9d7" }} />
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Serial Numbers</h1>
          </div>
          <Button onClick={() => { setDialogOpen(true); setBatchMode(false); }} style={{ background: "#03c9d7" }} data-testid="btn-add-serial">
            <Plus className="w-4 h-4 mr-1" /> เพิ่ม Serial
          </Button>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="ค้นหา Serial Number..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="pl-9" data-testid="input-search-serial"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40" data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="available">พร้อมใช้</SelectItem>
                  <SelectItem value="assembled">ประกอบแล้ว</SelectItem>
                  <SelectItem value="finished_good">สินค้า FG</SelectItem>
                  <SelectItem value="scrapped">ตัดทิ้ง</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>สินค้า</TableHead>
                  <TableHead>รหัสสินค้า</TableHead>
                  <TableHead>คลัง</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>วันที่สร้าง</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : !serials?.length ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8" data-testid="text-no-serials">ยังไม่มี Serial Number</TableCell></TableRow>
                ) : serials.map((s: any) => {
                  const st = STATUS_LABELS[s.status] || { label: s.status, color: "bg-gray-100 text-gray-700" };
                  return (
                    <TableRow key={s.id} data-testid={`row-serial-${s.id}`}>
                      <TableCell className="font-mono font-medium">{s.serialNumber}</TableCell>
                      <TableCell>{s.productName}</TableCell>
                      <TableCell className="font-mono text-gray-500">{s.productCode}</TableCell>
                      <TableCell>{s.warehouseName}</TableCell>
                      <TableCell><Badge className={st.color}>{st.label}</Badge></TableCell>
                      <TableCell className="text-sm text-gray-500">{s.createdAt ? new Date(s.createdAt).toLocaleDateString("th-TH") : ""}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle data-testid="text-dialog-title">{batchMode ? "สร้าง Serial แบบชุด" : "เพิ่ม Serial Number"}</DialogTitle>
            </DialogHeader>

            <div className="flex gap-2 mb-4">
              <Button variant={!batchMode ? "default" : "outline"} size="sm" onClick={() => setBatchMode(false)} data-testid="btn-single-mode">ทีละรายการ</Button>
              <Button variant={batchMode ? "default" : "outline"} size="sm" onClick={() => setBatchMode(true)} data-testid="btn-batch-mode">สร้างชุด</Button>
            </div>

            {!batchMode ? (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">สินค้า</label>
                  <Select value={form.productId} onValueChange={v => setForm(p => ({ ...p, productId: v }))}>
                    <SelectTrigger data-testid="select-product"><SelectValue placeholder="เลือกสินค้า" /></SelectTrigger>
                    <SelectContent>
                      {(productList || []).map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.code} — {p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Serial Number</label>
                  <Input value={form.serialNumber} onChange={e => setForm(p => ({ ...p, serialNumber: e.target.value }))} data-testid="input-serial-number" />
                </div>
                <div>
                  <label className="text-sm font-medium">คลังสินค้า</label>
                  <Select value={form.warehouseId} onValueChange={v => setForm(p => ({ ...p, warehouseId: v }))}>
                    <SelectTrigger data-testid="select-warehouse"><SelectValue placeholder="เลือกคลัง" /></SelectTrigger>
                    <SelectContent>
                      {(warehouseList || []).map((w: any) => (
                        <SelectItem key={w.id} value={String(w.id)}>{w.code} — {w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full" style={{ background: "#03c9d7" }}
                  disabled={!form.productId || !form.serialNumber || createMut.isPending}
                  onClick={() => createMut.mutate({ companyId, productId: Number(form.productId), serialNumber: form.serialNumber, warehouseId: form.warehouseId ? Number(form.warehouseId) : undefined })}
                  data-testid="btn-save-serial"
                >
                  {createMut.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} บันทึก
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">สินค้า</label>
                  <Select value={batchForm.productId} onValueChange={v => setBatchForm(p => ({ ...p, productId: v }))}>
                    <SelectTrigger data-testid="select-batch-product"><SelectValue placeholder="เลือกสินค้า" /></SelectTrigger>
                    <SelectContent>
                      {(productList || []).map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.code} — {p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-sm font-medium">Prefix</label>
                    <Input value={batchForm.prefix} onChange={e => setBatchForm(p => ({ ...p, prefix: e.target.value.toUpperCase() }))} placeholder="CE-" data-testid="input-batch-prefix" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">เริ่มจากเลข</label>
                    <Input type="number" value={batchForm.startNo} onChange={e => setBatchForm(p => ({ ...p, startNo: e.target.value }))} data-testid="input-batch-start" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">จำนวน</label>
                    <Input type="number" value={batchForm.count} onChange={e => setBatchForm(p => ({ ...p, count: e.target.value }))} data-testid="input-batch-count" />
                  </div>
                </div>
                <div className="text-xs text-gray-500">ตัวอย่าง: {batchForm.prefix}{String(Number(batchForm.startNo)).padStart(4, "0")} ถึง {batchForm.prefix}{String(Number(batchForm.startNo) + Number(batchForm.count) - 1).padStart(4, "0")}</div>
                <Button
                  className="w-full" style={{ background: "#03c9d7" }}
                  disabled={!batchForm.productId || !batchForm.prefix || batchMut.isPending}
                  onClick={() => batchMut.mutate({ companyId, productId: Number(batchForm.productId), prefix: batchForm.prefix, startNo: Number(batchForm.startNo), count: Number(batchForm.count), warehouseId: batchForm.warehouseId ? Number(batchForm.warehouseId) : undefined })}
                  data-testid="btn-save-batch"
                >
                  {batchMut.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} สร้าง {batchForm.count} รายการ
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ManufacturingLayout>
  );
}
