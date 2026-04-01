import DeliveryLayout from "@/components/delivery-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useState, useMemo } from "react";
import { Search, MapPin, Truck, CheckCircle2, Clock, Package, ExternalLink, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CARRIERS = [
  { value: "kerry", label: "Kerry Express", trackUrl: "https://th.kerryexpress.com/th/track/" },
  { value: "flash", label: "Flash Express", trackUrl: "https://flashexpress.com/fle/tracking?se=" },
  { value: "jt", label: "J&T Express", trackUrl: "https://www.jtexpress.co.th/trajectoryQuery?waybillNo=" },
  { value: "thaipost", label: "Thailand Post", trackUrl: "https://track.thailandpost.co.th/?trackNumber=" },
  { value: "ninjavan", label: "Ninja Van", trackUrl: "https://www.ninjavan.co/th-th/tracking?id=" },
  { value: "dhl", label: "DHL", trackUrl: "https://www.dhl.com/th-th/home/tracking.html?tracking-id=" },
  { value: "best", label: "Best Express", trackUrl: "https://www.best-inc.co.th/track?bills=" },
  { value: "scg", label: "SCG Express", trackUrl: "https://www.scgexpress.co.th/tracking/detail/" },
];

function statusBadge(status: string) {
  switch (status) {
    case "confirmed": return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">ยืนยันแล้ว</Badge>;
    case "shipping": return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">กำลังจัดส่ง</Badge>;
    case "delivered": return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">จัดส่งแล้ว</Badge>;
    case "returned": return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">ตีกลับ</Badge>;
    default: return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">{status}</Badge>;
  }
}

export default function DeliveryTracking() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const [searchText, setSearchText] = useState("");
  const [filterCarrier, setFilterCarrier] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/orders", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/orders?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const trackableOrders = useMemo(() => {
    return orders
      .filter((o: any) => o.status === "shipping" || o.status === "delivered" || o.status === "returned" || o.trackingNo)
      .filter((o: any) => {
        if (searchText) {
          const s = searchText.toLowerCase();
          if (!(o.orderNo?.toLowerCase().includes(s) || o.trackingNo?.toLowerCase().includes(s) || o.customerName?.toLowerCase().includes(s))) return false;
        }
        if (filterCarrier !== "all" && o.shippingProvider !== filterCarrier) return false;
        if (filterStatus !== "all" && o.status !== filterStatus) return false;
        return true;
      })
      .sort((a: any, b: any) => (b.orderDate || "").localeCompare(a.orderDate || ""));
  }, [orders, searchText, filterCarrier, filterStatus]);

  const copyTracking = (tracking: string) => {
    navigator.clipboard.writeText(tracking);
    toast({ title: "คัดลอกเลขพัสดุแล้ว", description: tracking });
  };

  const openTracking = (provider: string, trackingNo: string) => {
    const carrier = CARRIERS.find(c => c.value === provider);
    if (carrier) {
      window.open(carrier.trackUrl + trackingNo, "_blank");
    }
  };

  return (
    <DeliveryLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-tracking-title">ติดตามพัสดุ</h1>
          <p className="text-gray-500 mt-1">ติดตามสถานะการจัดส่งและเลข tracking</p>
        </div>

        <Card className="flexy-card border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  data-testid="input-tracking-search"
                  placeholder="ค้นหาเลข tracking, เลขออเดอร์, ชื่อลูกค้า..."
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterCarrier} onValueChange={setFilterCarrier}>
                <SelectTrigger className="w-[180px]" data-testid="select-carrier-filter">
                  <SelectValue placeholder="ขนส่งทั้งหมด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ขนส่งทั้งหมด</SelectItem>
                  {CARRIERS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
                  <SelectValue placeholder="สถานะทั้งหมด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">สถานะทั้งหมด</SelectItem>
                  <SelectItem value="shipping">กำลังจัดส่ง</SelectItem>
                  <SelectItem value="delivered">จัดส่งแล้ว</SelectItem>
                  <SelectItem value="returned">ตีกลับ</SelectItem>
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
                  <TableHead className="text-sm">ลูกค้า</TableHead>
                  <TableHead className="text-sm">ขนส่ง</TableHead>
                  <TableHead className="text-sm">เลข Tracking</TableHead>
                  <TableHead className="text-sm">สถานะ</TableHead>
                  <TableHead className="text-sm text-center">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trackableOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <MapPin className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-400 text-sm">ไม่พบรายการจัดส่ง</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  trackableOrders.map((order: any) => (
                    <TableRow key={order.id}>
                      <TableCell className="text-sm font-medium">{order.orderNo}</TableCell>
                      <TableCell className="text-sm">{order.customerName || "-"}</TableCell>
                      <TableCell className="text-sm">
                        {CARRIERS.find(c => c.value === order.shippingProvider)?.label || order.shippingProvider || "-"}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {order.trackingNo || <span className="text-gray-400">-</span>}
                      </TableCell>
                      <TableCell>{statusBadge(order.status)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {order.trackingNo && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => copyTracking(order.trackingNo)}
                                title="คัดลอกเลข tracking"
                                data-testid={`button-copy-tracking-${order.id}`}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                              {order.shippingProvider && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => openTracking(order.shippingProvider, order.trackingNo)}
                                  title="ติดตามพัสดุ"
                                  data-testid={`button-track-${order.id}`}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DeliveryLayout>
  );
}
