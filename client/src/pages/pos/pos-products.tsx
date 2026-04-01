import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import PosLayout from "@/components/pos-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Search, Package, Tag, BarChart3, ArrowUpDown, Filter, Box } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PosProducts() {
  const { selectedCompanyId } = useCompany();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortField, setSortField] = useState<"name" | "sold" | "stock">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["/api/pos/products", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/pos/products?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const categories = [...new Set(products.map((p: any) => p.categoryName || "ไม่มีหมวด"))].sort();

  const filtered = products
    .filter((p: any) => {
      const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search);
      const matchCat = categoryFilter === "all" || (p.categoryName || "ไม่มีหมวด") === categoryFilter;
      return matchSearch && matchCat;
    })
    .sort((a: any, b: any) => {
      let va: any, vb: any;
      if (sortField === "name") { va = a.name || ""; vb = b.name || ""; }
      else if (sortField === "sold") { va = a.totalSold || 0; vb = b.totalSold || 0; }
      else { va = a.stockQty || 0; vb = b.stockQty || 0; }
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? va - vb : vb - va;
    });

  const totalProducts = products.length;
  const activeProducts = products.filter((p: any) => p.isActive !== false).length;
  const lowStock = products.filter((p: any) => (p.stockQty || 0) <= (p.reorderPoint || 5) && (p.stockQty || 0) > 0).length;
  const outOfStock = products.filter((p: any) => (p.stockQty || 0) <= 0).length;

  const toggleSort = (field: "name" | "sold" | "stock") => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  return (
    <PosLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2" data-testid="text-page-title">
              <Package className="w-6 h-6 text-[#03c9d7]" /> สินค้า POS
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">รายการสินค้าสำหรับขายหน้าร้าน</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-none shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">สินค้าทั้งหมด</div>
              <div className="text-2xl font-bold text-slate-800" data-testid="text-total-products">{totalProducts}</div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">ใช้งานอยู่</div>
              <div className="text-2xl font-bold text-emerald-600" data-testid="text-active-products">{activeProducts}</div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">สต็อกต่ำ</div>
              <div className="text-2xl font-bold text-amber-600" data-testid="text-low-stock">{lowStock}</div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">สินค้าหมด</div>
              <div className="text-2xl font-bold text-red-500" data-testid="text-out-of-stock">{outOfStock}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-none shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="ค้นหาชื่อ, SKU, บาร์โค้ด..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" data-testid="input-search" />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48" data-testid="select-category">
                  <Filter className="w-4 h-4 mr-1 text-slate-400" />
                  <SelectValue placeholder="หมวดหมู่" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกหมวด</SelectItem>
                  {categories.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
                      <TableHead>
                        <Button variant="ghost" size="sm" className="px-0 font-semibold" onClick={() => toggleSort("name")} data-testid="button-sort-name">
                          ชื่อสินค้า <ArrowUpDown className="w-3 h-3 ml-1" />
                        </Button>
                      </TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>บาร์โค้ด</TableHead>
                      <TableHead>หมวดหมู่</TableHead>
                      <TableHead className="text-right">ราคาขาย</TableHead>
                      <TableHead className="text-right">
                        <Button variant="ghost" size="sm" className="px-0 font-semibold" onClick={() => toggleSort("stock")} data-testid="button-sort-stock">
                          คงเหลือ <ArrowUpDown className="w-3 h-3 ml-1" />
                        </Button>
                      </TableHead>
                      <TableHead>สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p: any, i: number) => {
                      const stock = p.stockQty ?? 0;
                      const stockColor = stock <= 0 ? "text-red-500" : stock <= (p.reorderPoint || 5) ? "text-amber-600" : "text-emerald-600";
                      return (
                        <TableRow key={p.id} data-testid={`row-product-${p.id}`}>
                          <TableCell className="text-slate-400 text-sm">{i + 1}</TableCell>
                          <TableCell>
                            <div className="font-medium text-slate-800">{p.name}</div>
                            {p.nameEn && <div className="text-xs text-slate-400">{p.nameEn}</div>}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600 font-mono">{p.sku || "-"}</TableCell>
                          <TableCell className="text-sm text-slate-600 font-mono">{p.barcode || "-"}</TableCell>
                          <TableCell>
                            {p.categoryName ? <Badge variant="outline" className="text-xs">{p.categoryName}</Badge> : <span className="text-slate-400 text-xs">-</span>}
                          </TableCell>
                          <TableCell className="text-right font-medium">฿{Number(p.price || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className={`text-right font-bold ${stockColor}`}>{stock.toLocaleString()}</TableCell>
                          <TableCell>
                            {p.isActive === false
                              ? <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50 text-xs">ปิดใช้งาน</Badge>
                              : <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-xs">ใช้งาน</Badge>
                            }
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="text-xs text-slate-400 mt-3 text-right">แสดง {filtered.length} / {totalProducts} รายการ</div>
          </CardContent>
        </Card>
      </div>
    </PosLayout>
  );
}
