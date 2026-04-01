import DeliveryLayout from "@/components/delivery-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useState, useMemo } from "react";
import { MessageCircle, Send, Search, CheckCircle2, Clock, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DeliveryLineNotify() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/orders", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/orders?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: deliveryLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/delivery-logs", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/delivery-logs?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const shippingOrders = useMemo(() => {
    return orders
      .filter((o: any) => (o.status === "shipping" || o.status === "delivered") && o.trackingNo)
      .filter((o: any) => {
        if (!searchText) return true;
        const s = searchText.toLowerCase();
        return o.orderNo?.toLowerCase().includes(s) || o.trackingNo?.toLowerCase().includes(s) || o.customerName?.toLowerCase().includes(s);
      })
      .map((o: any) => {
        const log = deliveryLogs.find((l: any) => l.orderId === o.id && l.channel === "line");
        return { ...o, lineSent: !!log, lineSentAt: log?.sentAt };
      })
      .sort((a: any, b: any) => (a.lineSent ? 1 : 0) - (b.lineSent ? 1 : 0));
  }, [orders, searchText, deliveryLogs]);

  const notSentOrders = shippingOrders.filter((o: any) => !o.lineSent);

  const sendLineMutation = useMutation({
    mutationFn: async (orderIds: number[]) => {
      const r = await fetch("/api/delivery/send-line-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderIds, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error("Failed to send");
      return r.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "ส่งแจ้งเตือนสำเร็จ", description: `ส่ง LINE แจ้ง tracking ${data.sent || selected.size} รายการ` });
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-logs"] });
    },
    onError: () => {
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถส่งแจ้งเตือนได้", variant: "destructive" });
    },
  });

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === notSentOrders.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(notSentOrders.map((o: any) => o.id)));
    }
  };

  return (
    <DeliveryLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="text-line-notify-title">แจ้ง Tracking ผ่าน LINE</h1>
            <p className="text-gray-500 mt-1">ส่งเลข tracking ให้ลูกค้าผ่าน LINE Push Message</p>
          </div>
          <Button
            style={{ background: "#05b187" }}
            className="text-white hover:opacity-90"
            disabled={selected.size === 0 || sendLineMutation.isPending}
            onClick={() => sendLineMutation.mutate(Array.from(selected))}
            data-testid="button-send-line"
          >
            {sendLineMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            ส่ง LINE ({selected.size})
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="flexy-card border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">ยังไม่ได้แจ้ง</p>
                <p className="text-xl font-bold text-amber-600">{notSentOrders.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="flexy-card border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">แจ้งแล้ว</p>
                <p className="text-xl font-bold text-green-600">{shippingOrders.filter((o: any) => o.lineSent).length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="flexy-card border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">มี Tracking ทั้งหมด</p>
                <p className="text-xl font-bold text-blue-600">{shippingOrders.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="flexy-card border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                data-testid="input-line-search"
                placeholder="ค้นหาเลข tracking, เลขออเดอร์, ชื่อลูกค้า..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="flexy-card border-0 shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={notSentOrders.length > 0 && selected.size === notSentOrders.length}
                      onCheckedChange={selectAll}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead className="text-sm">เลขออเดอร์</TableHead>
                  <TableHead className="text-sm">ลูกค้า</TableHead>
                  <TableHead className="text-sm">เลข Tracking</TableHead>
                  <TableHead className="text-sm">ขนส่ง</TableHead>
                  <TableHead className="text-sm text-center">สถานะ LINE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shippingOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <MessageCircle className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-400 text-sm">ไม่มีรายการที่มีเลข tracking</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  shippingOrders.map((order: any) => (
                    <TableRow key={order.id} className={order.lineSent ? "opacity-60" : ""}>
                      <TableCell>
                        {!order.lineSent && (
                          <Checkbox
                            checked={selected.has(order.id)}
                            onCheckedChange={() => toggleSelect(order.id)}
                            data-testid={`checkbox-order-${order.id}`}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{order.orderNo}</TableCell>
                      <TableCell className="text-sm">{order.customerName || "-"}</TableCell>
                      <TableCell className="text-sm font-mono">{order.trackingNo}</TableCell>
                      <TableCell className="text-sm">{order.shippingProvider || "-"}</TableCell>
                      <TableCell className="text-center">
                        {order.lineSent ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            ส่งแล้ว
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100">
                            <Clock className="h-3 w-3 mr-1" />
                            ยังไม่ส่ง
                          </Badge>
                        )}
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
