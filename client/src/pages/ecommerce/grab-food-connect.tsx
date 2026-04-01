import { useState } from "react";
import { useLocation } from "wouter";
import EcommerceLayout from "@/components/ecommerce-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import { formatDateTime } from "@/lib/format";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Link2, RefreshCw, CheckCircle2, XCircle, AlertCircle,
  Loader2, Settings, ShoppingCart, Trash2, Eye, ChevronDown, ChevronUp,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

import { useDateSettings } from "@/hooks/use-date-settings";
interface GrabConnection {
  id: number;
  platform: string;
  shopName: string;
  shopId: string | null;
  status: string;
  lastSyncAt: string | null;
  settings: string | null;
  accessToken: string | null;
  tokenExpiresAt: string | null;
}

interface GrabOrder {
  orderID: string;
  merchantID: string;
  shortOrderNumber: string;
  state: string;
  currency: { code: string };
  price: { subtotal: number; tax: number; deliveryFee: number; eaterPayment: number; merchantCharge?: number };
  items: Array<{ name: string; quantity: number; price: number; modifiers?: Array<{ name: string; price: number }> }>;
  receiver?: { name: string; phones?: string[]; address?: { unitNumber?: string; deliveryInstruction?: string } };
  orderTime: string;
  completeTime?: string;
}

interface SyncPreview {
  totalOrders: number;
  orders: Array<{
    orderNo: string;
    orderDate: string;
    buyerName: string;
    status: string;
    orderTotal: number;
    items: Array<{ productName: string; qty: number; unitPrice: number; totalPrice: number }>;
  }>;
}

function formatCurrency(v: number) {
  return v.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function GrabFoodConnect() {
  const [, navigate] = useLocation();
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { dateEra, dateFmt } = useDateSettings();
  const { data: docSettings } = useQuery<any>({
    queryKey: ["/api/document-settings", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return null;
      const res = await fetch(`/api/document-settings?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });
  const [setupOpen, setSetupOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [shopName, setShopName] = useState("");
  const [useStaging, setUseStaging] = useState(false);

  const [syncPreview, setSyncPreview] = useState<SyncPreview | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [documentType, setDocumentType] = useState("tax_invoice");
  const [syncStep, setSyncStep] = useState<"idle" | "preview" | "result">("idle");
  const [createResult, setCreateResult] = useState<any>(null);

  const { data: grabConnections = [], isLoading } = useQuery<GrabConnection[]>({
    queryKey: ["/api/grab/connections", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/connections?companyId=${selectedCompanyId}&platform=grab_food`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/grab/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          companyId: selectedCompanyId,
          clientId,
          clientSecret,
          merchantId,
          shopName,
          useStaging,
        }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.message || "เชื่อมต่อล้มเหลว");
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/grab/connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/connections"] });
      toast({ title: "เชื่อมต่อ Grab Food สำเร็จ" });
      setSetupOpen(false);
      setClientId("");
      setClientSecret("");
      setMerchantId("");
      setShopName("");
    },
    onError: (err: any) => {
      toast({ title: "เชื่อมต่อล้มเหลว", description: err.message, variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (connectionId: number) => {
      const r = await fetch("/api/grab/sync-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ connectionId, companyId: selectedCompanyId }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.message || "ดึงข้อมูลล้มเหลว");
      }
      return r.json() as Promise<SyncPreview>;
    },
    onSuccess: (data) => {
      setSyncPreview(data);
      setSelectedOrders(new Set(data.orders.map(o => o.orderNo)));
      setSyncStep("preview");
      toast({ title: `พบ ${data.totalOrders} ออเดอร์จาก Grab Food` });
    },
    onError: (err: any) => {
      toast({ title: "ดึงข้อมูลล้มเหลว", description: err.message, variant: "destructive" });
    },
  });

  const createDocsMutation = useMutation({
    mutationFn: async () => {
      if (!syncPreview) throw new Error("ไม่มีข้อมูล");
      const selectedOrderData = syncPreview.orders.filter(o => selectedOrders.has(o.orderNo));
      const r = await fetch("/api/ecommerce/import/create-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          companyId: selectedCompanyId,
          documentType,
          platform: "grab_food",
          orders: selectedOrderData.map(o => ({
            ...o,
            platform: "grab_food",
            buyerPhone: "",
            buyerAddress: "",
            trackingNo: "",
            shippingProvider: "Grab",
            shippingFee: 0,
            platformDiscount: 0,
            sellerDiscount: 0,
            paymentMethod: "GrabPay",
            commissionFee: 0,
            subtotal: o.orderTotal,
            items: o.items.map(it => ({
              ...it,
              sku: "",
              discount: 0,
              vatType: "vat7",
            })),
          })),
        }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.message || "สร้างเอกสารล้มเหลว");
      }
      return r.json();
    },
    onSuccess: (data) => {
      setCreateResult(data);
      setSyncStep("result");
      toast({
        title: `สร้างเอกสารสำเร็จ ${data.totalCreated} รายการ`,
        description: data.totalErrors > 0 ? `มีข้อผิดพลาด ${data.totalErrors} รายการ` : undefined,
      });
    },
    onError: (err: any) => {
      toast({ title: "สร้างเอกสารล้มเหลว", description: err.message, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (connectionId: number) => {
      const r = await fetch(`/api/ecommerce/connections/${connectionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/grab/connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/connections"] });
      toast({ title: "ยกเลิกการเชื่อมต่อสำเร็จ" });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const toggleOrder = (orderNo: string) => {
    const s = new Set(selectedOrders);
    if (s.has(orderNo)) s.delete(orderNo); else s.add(orderNo);
    setSelectedOrders(s);
  };

  const toggleExpand = (orderNo: string) => {
    const s = new Set(expandedOrders);
    if (s.has(orderNo)) s.delete(orderNo); else s.add(orderNo);
    setExpandedOrders(s);
  };

  const resetSync = () => {
    setSyncPreview(null);
    setSelectedOrders(new Set());
    setExpandedOrders(new Set());
    setSyncStep("idle");
    setCreateResult(null);
  };

  return (
    <EcommerceLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/ecommerce/hub")} data-testid="btn-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">Grab Food API</h1>
            <p className="text-sm text-gray-500">เชื่อมต่อ Grab Food Partner API เพื่อดึงออเดอร์อัตโนมัติ</p>
          </div>
          <Button onClick={() => setSetupOpen(true)} data-testid="btn-add-grab" style={{ background: "#00B14F" }} className="text-white hover:opacity-90">
            <Link2 className="h-4 w-4 mr-1.5" />เพิ่มการเชื่อมต่อ
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />กำลังโหลด...</div>
        ) : grabConnections.length === 0 ? (
          <Card className="flexy-card">
            <CardContent className="text-center py-12">
              <div className="text-5xl mb-3">🏍️</div>
              <h3 className="font-semibold text-lg mb-2">ยังไม่ได้เชื่อมต่อ Grab Food</h3>
              <p className="text-sm text-gray-500 mb-4">กดปุ่ม "เพิ่มการเชื่อมต่อ" เพื่อตั้งค่า Grab Food Partner API</p>
              <div className="text-left max-w-md mx-auto bg-gray-50 rounded-lg p-4 text-sm space-y-2">
                <p className="font-medium text-gray-700">ขั้นตอนการเชื่อมต่อ:</p>
                <p className="text-gray-600">1. สมัคร Grab Partner API ที่ developer.grab.com</p>
                <p className="text-gray-600">2. สร้าง App เพื่อรับ Client ID และ Client Secret</p>
                <p className="text-gray-600">3. จดบันทึก Merchant ID ของร้าน</p>
                <p className="text-gray-600">4. กรอกข้อมูลในฟอร์มเชื่อมต่อ</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {grabConnections.map(conn => {
              const settings = conn.settings ? JSON.parse(conn.settings) : {};
              const isConnected = conn.status === "connected";
              const isExpired = conn.tokenExpiresAt ? new Date(conn.tokenExpiresAt) < new Date() : false;

              return (
                <Card key={conn.id} className="flexy-card" data-testid={`card-grab-conn-${conn.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-xl">🏍️</div>
                        <div>
                          <h3 className="font-semibold">{conn.shopName}</h3>
                          <p className="text-xs text-gray-500">Merchant ID: {settings.merchantId || "-"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isConnected && !isExpired ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            <CheckCircle2 className="h-3 w-3 mr-1" />เชื่อมต่อแล้ว
                          </Badge>
                        ) : isExpired ? (
                          <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
                            <AlertCircle className="h-3 w-3 mr-1" />Token หมดอายุ
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                            <XCircle className="h-3 w-3 mr-1" />ไม่ได้เชื่อมต่อ
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-4 text-sm mb-4">
                      <div><span className="text-gray-500">สถานะ:</span> <span className="font-medium">{isConnected ? "เชื่อมต่อแล้ว" : conn.status}</span></div>
                      <div><span className="text-gray-500">ซิงค์ล่าสุด:</span> <span className="font-medium">{formatDateTime(conn.lastSyncAt, dateEra, dateFmt)}</span></div>
                      <div><span className="text-gray-500">Environment:</span> <span className="font-medium">{settings.useStaging ? "Staging" : "Production"}</span></div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => { resetSync(); syncMutation.mutate(conn.id); }}
                        disabled={syncMutation.isPending}
                        data-testid={`btn-sync-${conn.id}`}
                        style={{ background: "#00B14F" }}
                        className="text-white hover:opacity-90"
                      >
                        {syncMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
                        ดึงออเดอร์
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => { if (confirm("ต้องการยกเลิกการเชื่อมต่อนี้?")) disconnectMutation.mutate(conn.id); }}
                        data-testid={`btn-disconnect-${conn.id}`}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-1.5" />ยกเลิก
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {syncStep === "preview" && syncPreview && (
          <Card className="flexy-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-green-600" />
                  ออเดอร์จาก Grab Food ({syncPreview.totalOrders} รายการ)
                </h2>
                <div className="flex items-center gap-2">
                  <Select value={documentType} onValueChange={setDocumentType}>
                    <SelectTrigger className="w-48" data-testid="select-doc-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tax_invoice">ใบกำกับภาษี (TIV)</SelectItem>
                      <SelectItem value="invoice">ใบแจ้งหนี้ (IV)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Checkbox
                  checked={selectedOrders.size === syncPreview.orders.length}
                  onCheckedChange={() => {
                    if (selectedOrders.size === syncPreview.orders.length) setSelectedOrders(new Set());
                    else setSelectedOrders(new Set(syncPreview.orders.map(o => o.orderNo)));
                  }}
                  data-testid="checkbox-select-all"
                />
                <span className="text-sm text-gray-600">เลือกทั้งหมด ({selectedOrders.size}/{syncPreview.orders.length})</span>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-10"></TableHead>
                      <TableHead>เลขออเดอร์</TableHead>
                      <TableHead>ลูกค้า</TableHead>
                      <TableHead>วันที่</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead className="text-right">ยอดรวม</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncPreview.orders.map(order => (
                      <>
                        <TableRow key={order.orderNo} data-testid={`row-order-${order.orderNo}`}>
                          <TableCell>
                            <Checkbox
                              checked={selectedOrders.has(order.orderNo)}
                              onCheckedChange={() => toggleOrder(order.orderNo)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm">{order.orderNo}</TableCell>
                          <TableCell>{order.buyerName || "-"}</TableCell>
                          <TableCell className="text-sm">{formatDateTime(order.orderDate, dateEra, dateFmt)}</TableCell>
                          <TableCell>
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{order.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">฿{formatCurrency(order.orderTotal)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => toggleExpand(order.orderNo)}>
                              {expandedOrders.has(order.orderNo) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expandedOrders.has(order.orderNo) && (
                          <TableRow>
                            <TableCell colSpan={7} className="bg-gray-50 p-3">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>รายการ</TableHead>
                                    <TableHead className="text-right">จำนวน</TableHead>
                                    <TableHead className="text-right">ราคา</TableHead>
                                    <TableHead className="text-right">รวม</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {order.items.map((it, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell className="text-sm">{it.productName}</TableCell>
                                      <TableCell className="text-right">{it.qty}</TableCell>
                                      <TableCell className="text-right">฿{formatCurrency(it.unitPrice)}</TableCell>
                                      <TableCell className="text-right">฿{formatCurrency(it.totalPrice)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-between items-center pt-2">
                <Button variant="outline" onClick={resetSync} data-testid="btn-cancel-sync">ยกเลิก</Button>
                <Button
                  onClick={() => createDocsMutation.mutate()}
                  disabled={selectedOrders.size === 0 || createDocsMutation.isPending}
                  data-testid="btn-create-docs"
                  style={{ background: "#00B14F" }}
                  className="text-white hover:opacity-90"
                >
                  {createDocsMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                  สร้างเอกสาร ({selectedOrders.size} รายการ)
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {syncStep === "result" && createResult && (
          <Card className="flexy-card">
            <CardContent className="py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-2">สร้างเอกสารจาก Grab Food สำเร็จ</h3>
              <p className="text-gray-600 mb-1">สร้างสำเร็จ: {createResult.totalCreated} รายการ</p>
              {createResult.totalDuplicate > 0 && <p className="text-yellow-600 mb-1">ข้ามรายการซ้ำ: {createResult.totalDuplicate} รายการ</p>}
              {createResult.totalErrors > 0 && <p className="text-red-600 mb-1">ข้อผิดพลาด: {createResult.totalErrors} รายการ</p>}
              <div className="mt-4 flex justify-center gap-3">
                <Button variant="outline" onClick={resetSync} data-testid="btn-sync-more">ดึงออเดอร์เพิ่ม</Button>
                <Button onClick={() => navigate("/sales/tax-invoices")} style={{ background: "#00B14F" }} className="text-white hover:opacity-90" data-testid="btn-view-docs">
                  <Eye className="h-4 w-4 mr-1.5" />ดูเอกสาร
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />ตั้งค่า Grab Food Partner API
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">ชื่อร้าน</Label>
                <Input
                  value={shopName}
                  onChange={e => setShopName(e.target.value)}
                  placeholder="เช่น ร้านส้มตำแม่ลำยอง"
                  data-testid="input-shop-name"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Client ID</Label>
                <Input
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  placeholder="จาก Grab Developer Console"
                  data-testid="input-client-id"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Client Secret</Label>
                <Input
                  type="password"
                  value={clientSecret}
                  onChange={e => setClientSecret(e.target.value)}
                  placeholder="จาก Grab Developer Console"
                  data-testid="input-client-secret"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Merchant ID</Label>
                <Input
                  value={merchantId}
                  onChange={e => setMerchantId(e.target.value)}
                  placeholder="รหัสร้านบน Grab"
                  data-testid="input-merchant-id"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={useStaging}
                  onCheckedChange={(v) => setUseStaging(!!v)}
                  data-testid="checkbox-staging"
                />
                <Label className="text-sm text-gray-600">ใช้ Staging Environment (สำหรับทดสอบ)</Label>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                <p className="font-medium mb-1">วิธีขอ API Credentials:</p>
                <p>1. ไปที่ developer.grab.com และสมัครเป็น Partner</p>
                <p>2. สร้าง Application ใหม่เลือก scope "food.partner_api"</p>
                <p>3. คัดลอก Client ID, Client Secret จาก Dashboard</p>
                <p>4. Merchant ID ดูได้จาก GrabMerchant Portal</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setSetupOpen(false)}>ยกเลิก</Button>
                <Button
                  onClick={() => connectMutation.mutate()}
                  disabled={!clientId || !clientSecret || !merchantId || !shopName || connectMutation.isPending}
                  data-testid="btn-connect"
                  style={{ background: "#00B14F" }}
                  className="text-white hover:opacity-90"
                >
                  {connectMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Link2 className="h-4 w-4 mr-1.5" />}
                  เชื่อมต่อ
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </EcommerceLayout>
  );
}
