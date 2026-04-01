import { useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useLocation } from "wouter";
import { Plus, Users, ChefHat, UtensilsCrossed, ArrowRight, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statusColors: Record<string, string> = {
  available: "bg-green-100 text-green-700 border-green-300",
  occupied: "bg-red-100 text-red-700 border-red-300",
  reserved: "bg-amber-100 text-amber-700 border-amber-300",
  cleaning: "bg-blue-100 text-blue-700 border-blue-300",
};
const statusLabels: Record<string, string> = {
  available: "ว่าง", occupied: "มีลูกค้า", reserved: "จอง", cleaning: "ทำความสะอาด",
};

export default function RestaurantPosIndex() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [guestCount, setGuestCount] = useState("2");

  const { data: areas } = useQuery<any[]>({
    queryKey: ["/api/restaurant/areas", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/restaurant/areas?companyId=${companyId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!companyId,
  });

  const { data: tables } = useQuery<any[]>({
    queryKey: ["/api/restaurant/tables", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/restaurant/tables?companyId=${companyId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!companyId,
  });

  const { data: activeOrders } = useQuery<any[]>({
    queryKey: ["/api/restaurant/orders", companyId, "active"],
    queryFn: async () => {
      const res = await fetch(`/api/restaurant/orders?companyId=${companyId}&status=open`, { credentials: "include" });
      const open = await res.json();
      const res2 = await fetch(`/api/restaurant/orders?companyId=${companyId}&status=preparing`, { credentials: "include" });
      const prep = await res2.json();
      return [...open, ...prep];
    },
    enabled: !!companyId,
  });

  const createOrder = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/restaurant/orders", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ companyId, tableId: selectedTable?.id, guestCount: Number(guestCount), items: [] }),
      });
      return res.json();
    },
    onSuccess: (order) => {
      setShowNewOrder(false);
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/tables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/orders"] });
      navigate(`/restaurant-pos/order/${order.id}`);
    },
  });

  const getTableOrder = (tableId: number) => activeOrders?.find(o => o.tableId === tableId);

  const groupedTables = areas?.map(area => ({
    ...area,
    tables: (tables || []).filter(t => t.areaId === area.id),
  })) || [];

  const ungroupedTables = (tables || []).filter(t => !t.areaId);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UtensilsCrossed className="h-6 w-6 text-[#03c9d7]" />
            <h1 className="text-xl font-heading font-bold">POS ร้านอาหาร</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/restaurant-pos/kitchen")} data-testid="btn-kitchen">
              <ChefHat className="h-4 w-4 mr-1" /> ครัว (KDS)
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/restaurant-pos/menu-settings")} data-testid="btn-menu-settings">
              <Settings className="h-4 w-4 mr-1" /> จัดการเมนู
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/restaurant-pos/table-settings")} data-testid="btn-table-settings">
              <Settings className="h-4 w-4 mr-1" /> จัดการโต๊ะ
            </Button>
          </div>
        </div>

        {groupedTables.map(area => (
          <div key={area.id} className="space-y-3">
            <h2 className="text-lg font-medium text-slate-700">{area.name}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {area.tables.map((table: any) => {
                const order = getTableOrder(table.id);
                return (
                  <Card key={table.id}
                    className={`cursor-pointer border-2 transition-all hover:shadow-md ${statusColors[table.status] || "bg-slate-50"}`}
                    onClick={() => {
                      if (order) { navigate(`/restaurant-pos/order/${order.id}`); }
                      else if (table.status === "available") { setSelectedTable(table); setShowNewOrder(true); }
                    }}
                    data-testid={`table-${table.id}`}
                  >
                    <CardContent className="p-4 text-center">
                      <p className="text-lg font-bold">{table.name}</p>
                      <p className="text-xs">{statusLabels[table.status]}</p>
                      <div className="flex items-center justify-center gap-1 mt-1 text-xs">
                        <Users className="h-3 w-3" /> {table.capacity}
                      </div>
                      {order && <Badge className="mt-2 text-xs">{order.orderNo}</Badge>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}

        {ungroupedTables.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-medium text-slate-700">ไม่มีโซน</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {ungroupedTables.map((table: any) => {
                const order = getTableOrder(table.id);
                return (
                  <Card key={table.id}
                    className={`cursor-pointer border-2 transition-all hover:shadow-md ${statusColors[table.status] || "bg-slate-50"}`}
                    onClick={() => {
                      if (order) navigate(`/restaurant-pos/order/${order.id}`);
                      else if (table.status === "available") { setSelectedTable(table); setShowNewOrder(true); }
                    }}
                    data-testid={`table-${table.id}`}
                  >
                    <CardContent className="p-4 text-center">
                      <p className="text-lg font-bold">{table.name}</p>
                      <p className="text-xs">{statusLabels[table.status]}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {(!tables || tables.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">
            <UtensilsCrossed className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">ยังไม่มีโต๊ะ</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/restaurant-pos/table-settings")} data-testid="btn-setup-tables">
              <Plus className="h-4 w-4 mr-1" /> ตั้งค่าโต๊ะ
            </Button>
          </div>
        )}
      </div>

      <Dialog open={showNewOrder} onOpenChange={setShowNewOrder}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>เปิดออเดอร์ - {selectedTable?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">จำนวนลูกค้า</label>
              <Input type="number" value={guestCount} onChange={e => setGuestCount(e.target.value)} min="1" data-testid="input-guest-count" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewOrder(false)}>ยกเลิก</Button>
            <Button onClick={() => createOrder.mutate()} className="bg-[#03c9d7] hover:bg-[#02b0bc]" data-testid="btn-create-order">
              <Plus className="h-4 w-4 mr-1" /> เปิดออเดอร์
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
