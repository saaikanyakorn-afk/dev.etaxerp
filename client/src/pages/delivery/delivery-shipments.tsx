import DeliveryLayout from "@/components/delivery-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useState, useMemo } from "react";
import { Search, Package, Truck, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { formatDate } from "@/lib/format";

const PLATFORMS = [
  { value: "shopee", label: "Shopee", bgLight: "bg-orange-100", textColor: "text-orange-700" },
  { value: "lazada", label: "Lazada", bgLight: "bg-indigo-100", textColor: "text-indigo-700" },
  { value: "tiktok", label: "TikTok Shop", bgLight: "bg-gray-100", textColor: "text-gray-900" },
  { value: "grab_food", label: "Grab Food", bgLight: "bg-green-100", textColor: "text-green-700" },
  { value: "line_man", label: "LINE MAN", bgLight: "bg-emerald-100", textColor: "text-emerald-700" },
  { value: "robinhood", label: "Robinhood", bgLight: "bg-purple-100", textColor: "text-purple-700" },
  { value: "amazon", label: "Amazon", bgLight: "bg-amber-100", textColor: "text-amber-700" },
];

function platformBadge(platform: string) {
  const p = PLATFORMS.find(pl => pl.value === platform);
  if (!p) return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">{platform}</Badge>;
  return <Badge className={`${p.bgLight} ${p.textColor} hover:${p.bgLight}`}>{p.label}</Badge>;
}

function statusBadge(status: string) {
  switch (status) {
    case "pending": return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100"><Clock className="h-3 w-3 mr-1" />รอดำเนินการ</Badge>;
    case "confirmed": return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100"><Package className="h-3 w-3 mr-1" />ยืนยันแล้ว</Badge>;
    case "shipping": return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100"><Truck className="h-3 w-3 mr-1" />กำลังจัดส่ง</Badge>;
    case "delivered": return <Badge className="bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle2 className="h-3 w-3 mr-1" />จัดส่งแล้ว</Badge>;
    case "returned": return <Badge className="bg-red-100 text-red-700 hover:bg-red-100"><AlertCircle className="h-3 w-3 mr-1" />ตีกลับ</Badge>;
    default: return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">{status}</Badge>;
  }
}

export default function DeliveryShipments() {
  const { selectedCompanyId } = useCompany();
  const [searchText, setSearchText] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPlatform, setFilterPlatform] = useState("all");

  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/orders", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/orders?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const filtered = useMemo(() => {
    return orders
      .filter((o: any) => o.status !== "cancelled")
      .filter((o: any) => {
        if (searchText) {
          const s = searchText.toLowerCase();
          if (!(o.orderNo?.toLowerCase().includes(s) || o.trackingNo?.toLowerCase().includes(s) || o.customerName?.toLowerCase().includes(s))) return false;
        }
        if (filterStatus !== "all" && o.status !== filterStatus) return false;
        if (filterPlatform !== "all" && o.platform !== filterPlatform) return false;
        return true;
      })
      .sort((a: any, b: any) => (b.orderDate || "").localeCompare(a.orderDate || ""));
  }, [orders, searchText, filterStatus, filterPlatform]);

  return (
    <DeliveryLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-shipments-title">รายการจัดส่ง</h1>
          <p className="text-gray-500 mt-1">รายการออเดอร์ทั้งหมดและสถานะการจัดส่ง</p>
        </div>

        <Card className="flexy-card border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  data-testid="input-shipments-search"
                  placeholder="ค้นหาเลขออเดอร์, tracking, ชื่อลูกค้า..."
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[160px]" data-testid="select-shipment-status">
                  <SelectValue placeholder="สถานะทั้งหมด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">สถานะทั้งหมด</SelectItem>
                  <SelectItem value="pending">รอดำเนินการ</SelectItem>
                  <SelectItem value="confirmed">ยืนยันแล้ว</SelectItem>
                  <SelectItem value="shipping">กำลังจัดส่ง</SelectItem>
                  <SelectItem value="delivered">จัดส่งแล้ว</SelectItem>
                  <SelectItem value="returned">ตีกลับ</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                <SelectTrigger className="w-[160px]" data-testid="select-shipment-platform">
                  <SelectValue placeholder="แพลตฟอร์มทั้งหมด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">แพลตฟอร์มทั้งหมด</SelectItem>
                  {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="flexy-card border-0 shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-sm">เลขออเดอร์</TableHead>
                  <TableHead className="text-sm">วันที่</TableHead>
                  <TableHead className="text-sm">ลูกค้า</TableHead>
                  <TableHead className="text-sm">แพลตฟอร์ม</TableHead>
                  <TableHead className="text-sm">ขนส่ง</TableHead>
                  <TableHead className="text-sm">เลข Tracking</TableHead>
                  <TableHead className="text-sm">สถานะ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <Package className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-400 text-sm">ไม่พบรายการจัดส่ง</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((order: any) => (
                    <TableRow key={order.id}>
                      <TableCell className="text-sm font-medium">{order.orderNo}</TableCell>
                      <TableCell className="text-sm text-gray-500">{order.orderDate || "-"}</TableCell>
                      <TableCell className="text-sm">{order.customerName || "-"}</TableCell>
                      <TableCell>{platformBadge(order.platform)}</TableCell>
                      <TableCell className="text-sm">{order.shippingProvider || "-"}</TableCell>
                      <TableCell className="text-sm font-mono">{order.trackingNo || <span className="text-gray-400">-</span>}</TableCell>
                      <TableCell>{statusBadge(order.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {filtered.length > 0 && (
              <div className="px-4 py-3 border-t text-sm text-gray-500">
                แสดง {filtered.length} จาก {orders.length} รายการ
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DeliveryLayout>
  );
}
