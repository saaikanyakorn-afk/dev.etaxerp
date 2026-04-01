import { useState, useEffect } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Plus, Minus, Send, CreditCard, Loader2, Split, Trash2, ChefHat } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function fmt(val: number | string) { return Number(val).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const itemStatusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "รอส่งครัว", color: "bg-gray-100 text-gray-600" },
  preparing: { label: "กำลังทำ", color: "bg-amber-100 text-amber-700" },
  ready: { label: "พร้อมเสิร์ฟ", color: "bg-green-100 text-green-700" },
  served: { label: "เสิร์ฟแล้ว", color: "bg-blue-100 text-blue-700" },
  cancelled: { label: "ยกเลิก", color: "bg-red-100 text-red-700" },
};

export default function RestaurantOrder() {
  const [, params] = useRoute("/restaurant-pos/order/:id");
  const orderId = Number(params?.id);
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddItem, setShowAddItem] = useState(false);
  const [showSplitBill, setShowSplitBill] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [serviceChargeRate, setServiceChargeRate] = useState("10");
  const [splitCount, setSplitCount] = useState("2");

  const { data: order, refetch } = useQuery<any>({
    queryKey: ["/api/restaurant/orders", orderId],
    queryFn: async () => {
      const res = await fetch(`/api/restaurant/orders/${orderId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!orderId,
  });

  const { data: menuCategories } = useQuery<any[]>({
    queryKey: ["/api/restaurant/menu-categories", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/restaurant/menu-categories?companyId=${companyId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!companyId,
  });

  const { data: menuItems } = useQuery<any[]>({
    queryKey: ["/api/restaurant/menu-items", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/restaurant/menu-items?companyId=${companyId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!companyId,
  });

  const addItemsMutation = useMutation({
    mutationFn: async (items: any[]) => {
      const res = await fetch(`/api/restaurant/orders/${orderId}/items`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ items }),
      });
      return res.json();
    },
    onSuccess: () => { refetch(); setShowAddItem(false); },
  });

  const sendToKitchen = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/restaurant/orders/${orderId}/send-to-kitchen`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({}),
      });
      return res.json();
    },
    onSuccess: (result) => {
      toast({ title: "ส่งครัวแล้ว", description: `${result.itemCount || 0} รายการ` });
      refetch();
    },
  });

  const calculateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/restaurant/orders/${orderId}/calculate`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ serviceChargeRate: Number(serviceChargeRate), discountAmount: 0 }),
      });
      return res.json();
    },
    onSuccess: () => { refetch(); setShowPayment(true); },
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/restaurant/orders/${orderId}/status`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ status: "paid" }),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "ชำระเงินสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant"] });
      navigate("/restaurant-pos");
    },
  });

  const splitBillMutation = useMutation({
    mutationFn: async () => {
      const total = parseFloat(order?.total || "0");
      const count = Number(splitCount);
      const perPerson = Math.round(total / count * 100) / 100;
      const splits = Array.from({ length: count }, (_, i) => ({
        splitLabel: `ส่วนที่ ${i + 1}`,
        amount: i === count - 1 ? (total - perPerson * (count - 1)).toFixed(2) : perPerson.toFixed(2),
        paymentMethod: "เงินสด",
      }));
      const res = await fetch(`/api/restaurant/orders/${orderId}/splits`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ splits }),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "แยกบิลแล้ว" });
      setShowSplitBill(false);
      refetch();
    },
  });

  const [cart, setCart] = useState<{ menuItemId: number; menuItemName: string; unitPrice: string; quantity: number; note: string }[]>([]);

  const addToCart = (item: any) => {
    const existing = cart.find(c => c.menuItemId === item.id);
    if (existing) {
      setCart(cart.map(c => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { menuItemId: item.id, menuItemName: item.name, unitPrice: item.price, quantity: 1, note: "" }]);
    }
  };

  const filteredMenu = selectedCategory
    ? (menuItems || []).filter(m => m.categoryId === selectedCategory && m.available)
    : (menuItems || []).filter(m => m.available);

  const pendingCount = order?.items?.filter((i: any) => i.status === "pending").length || 0;

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/restaurant-pos")} data-testid="btn-back">
              <ArrowLeft className="h-4 w-4 mr-1" /> กลับ
            </Button>
            <h1 className="text-xl font-heading font-bold">ออเดอร์ {order?.orderNo}</h1>
            <Badge>{order?.status === "open" ? "เปิด" : order?.status === "preparing" ? "กำลังทำ" : order?.status}</Badge>
          </div>
          <div className="flex gap-2">
            {pendingCount > 0 && (
              <Button onClick={() => sendToKitchen.mutate()} className="bg-amber-500 hover:bg-amber-600" data-testid="btn-send-kitchen">
                <ChefHat className="h-4 w-4 mr-1" /> ส่งครัว ({pendingCount})
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowAddItem(true)} data-testid="btn-add-item">
              <Plus className="h-4 w-4 mr-1" /> เพิ่มเมนู
            </Button>
            <Button variant="outline" onClick={() => { calculateMutation.mutate(); }} data-testid="btn-calc-bill">
              <CreditCard className="h-4 w-4 mr-1" /> คิดเงิน
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader><p className="font-medium">รายการอาหาร</p></CardHeader>
              <CardContent>
                {order?.items?.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">เมนู</th>
                        <th className="text-center p-2">จำนวน</th>
                        <th className="text-right p-2">ราคา</th>
                        <th className="text-right p-2">รวม</th>
                        <th className="text-center p-2">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item: any) => {
                        const st = itemStatusLabels[item.status] || { label: item.status, color: "bg-gray-100" };
                        return (
                          <tr key={item.id} className="border-b hover:bg-slate-50">
                            <td className="p-2">
                              {item.menuItemName}
                              {item.note && <p className="text-xs text-muted-foreground">{item.note}</p>}
                              {item.modifiers && <p className="text-xs text-blue-600">{typeof item.modifiers === "string" ? item.modifiers : JSON.stringify(item.modifiers)}</p>}
                            </td>
                            <td className="p-2 text-center">{item.quantity}</td>
                            <td className="p-2 text-right">{fmt(item.unitPrice)}</td>
                            <td className="p-2 text-right">{fmt(Number(item.unitPrice) * item.quantity)}</td>
                            <td className="p-2 text-center"><Badge className={st.color}>{st.label}</Badge></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-center text-muted-foreground py-8">ยังไม่มีรายการ กดเพิ่มเมนู</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader><p className="font-medium">สรุป</p></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span>จำนวนลูกค้า</span><span>{order?.guestCount}</span></div>
                <div className="flex justify-between"><span>ยอดรวม</span><span>{fmt(order?.subtotal || 0)}</span></div>
                <div className="flex justify-between items-center">
                  <span>เซอร์วิสชาร์จ</span>
                  <div className="flex items-center gap-1">
                    <Input type="number" value={serviceChargeRate} onChange={e => setServiceChargeRate(e.target.value)} className="w-16 h-7 text-right text-xs" />
                    <span className="text-xs">%</span>
                  </div>
                </div>
                {Number(order?.serviceCharge) > 0 && <div className="flex justify-between text-muted-foreground"><span>SC</span><span>{fmt(order?.serviceCharge)}</span></div>}
                {Number(order?.discountAmount) > 0 && <div className="flex justify-between text-red-500"><span>ส่วนลด</span><span>-{fmt(order?.discountAmount)}</span></div>}
                {Number(order?.vatAmount) > 0 && <div className="flex justify-between text-muted-foreground"><span>VAT (รวมใน)</span><span>{fmt(order?.vatAmount)}</span></div>}
                <div className="flex justify-between font-bold text-lg border-t pt-2"><span>รวมทั้งสิ้น</span><span>{fmt(order?.total || 0)}</span></div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowSplitBill(true)} data-testid="btn-split"><Split className="h-3 w-3 mr-1" /> แยกบิล</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader><DialogTitle>เพิ่มเมนู</DialogTitle></DialogHeader>
          <div className="flex gap-2 flex-wrap mb-4">
            <Button variant={!selectedCategory ? "default" : "outline"} size="sm" onClick={() => setSelectedCategory(null)}>ทั้งหมด</Button>
            {menuCategories?.map(c => (
              <Button key={c.id} variant={selectedCategory === c.id ? "default" : "outline"} size="sm" onClick={() => setSelectedCategory(c.id)}>
                {c.name}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-auto max-h-[400px]">
            {filteredMenu.map(item => (
              <Card key={item.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => addToCart(item)} data-testid={`menu-item-${item.id}`}>
                <CardContent className="p-3 text-center">
                  <p className="font-medium text-sm">{item.name}</p>
                  <p className="text-[#03c9d7] font-bold">{fmt(item.price)}</p>
                  {cart.find(c => c.menuItemId === item.id) && (
                    <Badge className="mt-1">x{cart.find(c => c.menuItemId === item.id)?.quantity}</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          {cart.length > 0 && (
            <div className="border-t pt-3 mt-3">
              <p className="text-sm font-medium mb-2">ตะกร้า ({cart.length} รายการ)</p>
              {cart.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1">
                  <span>{c.menuItemName}</span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setCart(cart.map((x, j) => j === i ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x))}><Minus className="h-3 w-3" /></Button>
                    <span>{c.quantity}</span>
                    <Button size="sm" variant="ghost" onClick={() => setCart(cart.map((x, j) => j === i ? { ...x, quantity: x.quantity + 1 } : x))}><Plus className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setCart(cart.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddItem(false); setCart([]); }}>ยกเลิก</Button>
            <Button disabled={cart.length === 0} onClick={() => { addItemsMutation.mutate(cart); setCart([]); }} className="bg-[#03c9d7] hover:bg-[#02b0bc]" data-testid="btn-confirm-add">
              เพิ่ม {cart.length} รายการ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>ชำระเงิน</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span>ยอดรวม</span><span>{fmt(order?.subtotal || 0)}</span></div>
            {Number(order?.serviceCharge) > 0 && <div className="flex justify-between"><span>Service Charge</span><span>{fmt(order?.serviceCharge)}</span></div>}
            <div className="flex justify-between font-bold text-xl border-t pt-2"><span>รวมทั้งสิ้น</span><span className="text-[#03c9d7]">{fmt(order?.total || 0)}</span></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayment(false)}>ยกเลิก</Button>
            <Button onClick={() => payMutation.mutate()} className="bg-green-600 hover:bg-green-700" data-testid="btn-confirm-pay">
              <CreditCard className="h-4 w-4 mr-1" /> ยืนยันชำระ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSplitBill} onOpenChange={setShowSplitBill}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>แยกบิล</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">แยกเป็นกี่ส่วน</label>
              <Input type="number" value={splitCount} onChange={e => setSplitCount(e.target.value)} min="2" data-testid="input-split-count" />
            </div>
            <p className="text-sm text-muted-foreground">ยอดรวม {fmt(order?.total || 0)} ÷ {splitCount} = {fmt(Number(order?.total || 0) / Number(splitCount || 1))} ต่อคน</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSplitBill(false)}>ยกเลิก</Button>
            <Button onClick={() => splitBillMutation.mutate()} className="bg-[#03c9d7] hover:bg-[#02b0bc]" data-testid="btn-confirm-split">
              แยกบิล
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
