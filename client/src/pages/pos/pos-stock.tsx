import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import PosLayout from "@/components/pos-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Search, Warehouse, AlertTriangle, Package, ArrowUpDown, Box } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PosStock() {
  const { selectedCompanyId } = useCompany();
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["/api/pos/products", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/pos/products?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: warehouseStock = [] } = useQuery({
    queryKey: ["/api/pos/warehouse-stock", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/pos/warehouse-stock?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const stockMap = new Map<number, any[]>();
  warehouseStock.forEach((ws: any) => {
    const arr = stockMap.get(ws.productId) || [];
    arr.push(ws);
    stockMap.set(ws.productId, arr);
  });

  const enriched = products.map((p: any) => {
    const stocks = stockMap.get(p.id) || [];
    const totalStock = stocks.reduce((s: number, w: any) => s + (w.quantity || 0), 0);
    return { ...p, warehouseStocks: stocks, totalStock: p.stockQty ?? totalStock };
  });

  const filtered = enriched
    .filter((p: any) => {
      const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase());
      if (stockFilter === "out") return matchSearch && p.totalStock <= 0;
      if (stockFilter === "low") return matchSearch && p.totalStock > 0 && p.totalStock <= (p.reorderPoint || 5);
      if (stockFilter === "ok") return matchSearch && p.totalStock > (p.reorderPoint || 5);
      return matchSearch;
    });

  const totalItems = enriched.length;
  const totalStockValue = enriched.reduce((s: number, p: any) => s + (p.totalStock * (p.cost || p.price || 0)), 0);
  const lowStockCount = enriched.filter((p: any) => p.totalStock > 0 && p.totalStock <= (p.reorderPoint || 5)).length;
  const outCount = enriched.filter((p: any) => p.totalStock <= 0).length;

  return (
    <PosLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2" data-testid="text-page-title">
            <Warehouse className="w-6 h-6 text-[#03c9d7]" /> คลังสินค้า POS
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">ตรวจสอบสต็อกสินค้าแยกตามคลัง</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-none shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">รายการสินค้า</div>
              <div className="text-2xl font-bold text-slate-800" data-testid="text-total-items">{totalItems}</div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">มูลค่าสต็อกรวม</div>
              <div className="text-2xl font-bold text-blue-600" data-testid="text-stock-value">฿{totalStockValue.toLocaleString("th-TH", { minimumFractionDigits: 0 })}</div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm cursor-pointer hover:bg-amber-50 transition-colors" onClick={() => setStockFilter(f => f === "low" ? "all" : "low")}>
            <CardContent className="p-4">
              <div className="text-xs text-slate-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-500" /> สต็อกต่ำ</div>
              <div className="text-2xl font-bold text-amber-600" data-testid="text-low-stock">{lowStockCount}</div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm cursor-pointer hover:bg-red-50 transition-colors" onClick={() => setStockFilter(f => f === "out" ? "all" : "out")}>
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">สินค้าหมด</div>
              <div className="text-2xl font-bold text-red-500" data-testid="text-out-of-stock">{outCount}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-none shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="ค้นหาชื่อสินค้า, SKU..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" data-testid="input-search" />
              </div>
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-44" data-testid="select-stock-filter">
                  <SelectValue placeholder="สถานะสต็อก" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="ok">สต็อกปกติ</SelectItem>
                  <SelectItem value="low">สต็อกต่ำ</SelectItem>
                  <SelectItem value="out">สินค้าหมด</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-slate-400">กำลังโหลด...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Box className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p>ไม่พบสินค้า</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>สินค้า</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">ราคาทุน</TableHead>
                      <TableHead className="text-right">ราคาขาย</TableHead>
                      <TableHead className="text-right">คงเหลือ</TableHead>
                      <TableHead className="text-right">มูลค่า</TableHead>
                      <TableHead>สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p: any, i: number) => {
                      const stock = p.totalStock || 0;
                      const cost = p.cost || p.price || 0;
                      const value = stock * cost;
                      let statusBadge;
                      if (stock <= 0) statusBadge = <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">หมด</Badge>;
                      else if (stock <= (p.reorderPoint || 5)) statusBadge = <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">ต่ำ</Badge>;
                      else statusBadge = <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">ปกติ</Badge>;
                      return (
                        <TableRow key={p.id} data-testid={`row-stock-${p.id}`}>
                          <TableCell className="text-slate-400 text-sm">{i + 1}</TableCell>
                          <TableCell>
                            <div className="font-medium text-slate-800">{p.name}</div>
                            {p.categoryName && <div className="text-xs text-slate-400">{p.categoryName}</div>}
                          </TableCell>
                          <TableCell className="text-sm font-mono text-slate-600">{p.sku || "-"}</TableCell>
                          <TableCell className="text-right text-sm">฿{Number(cost).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right text-sm">฿{Number(p.price || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className={`text-right font-bold ${stock <= 0 ? "text-red-500" : stock <= (p.reorderPoint || 5) ? "text-amber-600" : "text-emerald-600"}`}>
                            {stock.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-sm">฿{value.toLocaleString("th-TH", { minimumFractionDigits: 0 })}</TableCell>
                          <TableCell>{statusBadge}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="text-xs text-slate-400 mt-3 text-right">แสดง {filtered.length} / {totalItems} รายการ</div>
          </CardContent>
        </Card>
      </div>
    </PosLayout>
  );
}
