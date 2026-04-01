import DeliveryLayout from "@/components/delivery-layout";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { Package, Truck, CheckCircle2, Clock, Tag, MapPin, AlertCircle, TrendingUp, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function DeliveryDashboard() {
  const { selectedCompanyId } = useCompany();
  const [, navigate] = useLocation();

  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/orders", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/orders?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: batches = [] } = useQuery<any[]>({
    queryKey: ["/api/fulfillment/batches", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/fulfillment/batches?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const confirmedOrders = orders.filter((o: any) => o.status === "confirmed");
  const shippingOrders = orders.filter((o: any) => o.status === "shipping");
  const deliveredOrders = orders.filter((o: any) => o.status === "delivered");
  const pendingBatches = batches.filter((b: any) => b.status === "pending" || b.status === "picking" || b.status === "packing");
  const completedBatches = batches.filter((b: any) => b.status === "completed");

  const kpis = [
    { label: "รอจัดส่ง", value: confirmedOrders.length, icon: Clock, color: "#fec90f", bg: "bg-amber-50" },
    { label: "กำลังจัดส่ง", value: shippingOrders.length, icon: Truck, color: "var(--theme-primary)", bg: "bg-blue-50" },
    { label: "จัดส่งสำเร็จ", value: deliveredOrders.length, icon: CheckCircle2, color: "#05b187", bg: "bg-green-50" },
    { label: "Batch กำลังดำเนินการ", value: pendingBatches.length, icon: Package, color: "#fb9678", bg: "bg-orange-50" },
  ];

  const recentShipping = orders
    .filter((o: any) => o.status === "shipping" || o.status === "delivered")
    .sort((a: any, b: any) => (b.orderDate || "").localeCompare(a.orderDate || ""))
    .slice(0, 10);

  return (
    <DeliveryLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-delivery-dashboard-title">Delivery Hub</h1>
          <p className="text-gray-500 mt-1">ภาพรวมการจัดส่งสินค้า</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="flexy-card border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">{kpi.label}</p>
                    <p className="text-3xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
                  </div>
                  <div className={`h-12 w-12 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                    <kpi.icon className="h-6 w-6" style={{ color: kpi.color }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="flexy-card border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">ทางลัด</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2 hover:border-[#03c9d7] hover:bg-[#03c9d7]/5"
                  onClick={() => navigate("/delivery/fulfillment")}
                  data-testid="button-shortcut-fulfillment"
                >
                  <Package className="h-6 w-6" style={{ color: "#03c9d7" }} />
                  <span className="text-sm font-medium">Pick-Pack-Ship</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2 hover:border-[#03c9d7] hover:bg-[#03c9d7]/5"
                  onClick={() => navigate("/delivery/shipping-labels")}
                  data-testid="button-shortcut-labels"
                >
                  <Tag className="h-6 w-6" style={{ color: "#03c9d7" }} />
                  <span className="text-sm font-medium">พิมพ์ใบปะหน้า</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2 hover:border-[#03c9d7] hover:bg-[#03c9d7]/5"
                  onClick={() => navigate("/delivery/tracking")}
                  data-testid="button-shortcut-tracking"
                >
                  <MapPin className="h-6 w-6" style={{ color: "#03c9d7" }} />
                  <span className="text-sm font-medium">ติดตามพัสดุ</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2 hover:border-[#03c9d7] hover:bg-[#03c9d7]/5"
                  onClick={() => navigate("/delivery/line-notify")}
                  data-testid="button-shortcut-line"
                >
                  <MessageCircle className="h-6 w-6" style={{ color: "#05b187" }} />
                  <span className="text-sm font-medium">แจ้ง Tracking LINE</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="flexy-card border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">พัสดุล่าสุด</h3>
                <Badge variant="outline" className="text-[#03c9d7] border-[#03c9d7]">{recentShipping.length} รายการ</Badge>
              </div>
              <div className="space-y-2 max-h-[240px] overflow-y-auto">
                {recentShipping.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Truck className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">ยังไม่มีรายการจัดส่ง</p>
                  </div>
                ) : (
                  recentShipping.map((order: any) => (
                    <div key={order.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${order.status === "delivered" ? "bg-green-100" : "bg-blue-100"}`}>
                          {order.status === "delivered" ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <Truck className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{order.orderNo}</p>
                          <p className="text-xs text-gray-500">{order.customerName || "-"}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">{order.trackingNo || "ยังไม่มี tracking"}</p>
                        <p className="text-xs text-gray-400">{order.shippingProvider || ""}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="flexy-card border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">สรุปสถานะจัดส่ง</h3>
              <TrendingUp className="h-5 w-5 text-gray-400" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-xl bg-amber-50">
                <Clock className="h-6 w-6 mx-auto mb-2 text-amber-500" />
                <p className="text-2xl font-bold text-amber-600">{confirmedOrders.length}</p>
                <p className="text-xs text-amber-600/70 mt-1">รอจัดส่ง</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-blue-50">
                <Truck className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold text-blue-600">{shippingOrders.length}</p>
                <p className="text-xs text-blue-600/70 mt-1">กำลังจัดส่ง</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-green-50">
                <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-green-500" />
                <p className="text-2xl font-bold text-green-600">{deliveredOrders.length}</p>
                <p className="text-xs text-green-600/70 mt-1">จัดส่งสำเร็จ</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-red-50">
                <AlertCircle className="h-6 w-6 mx-auto mb-2 text-red-500" />
                <p className="text-2xl font-bold text-red-600">{orders.filter((o: any) => o.status === "returned").length}</p>
                <p className="text-xs text-red-600/70 mt-1">คืนสินค้า</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DeliveryLayout>
  );
}
