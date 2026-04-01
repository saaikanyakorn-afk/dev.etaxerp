import { useState } from "react";
import EcommerceLayout from "@/components/ecommerce-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Link2, Plus, Copy, XCircle, Loader2, Eye, Check, X,
  FileText, Settings, Users, ShieldCheck, ClipboardList, Globe, Clock, Mail
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useToast } from "@/hooks/use-toast";

export default function EcommerceSupplierPortal() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showCreateToken, setShowCreateToken] = useState(false);
  const [tokenForm, setTokenForm] = useState({ contactId: "", email: "" });
  const [selectedQuoteId, setSelectedQuoteId] = useState<number | null>(null);
  const [showQuoteDetail, setShowQuoteDetail] = useState(false);
  const [defaultExpiryDays, setDefaultExpiryDays] = useState("30");

  const { data: tokens = [], isLoading: tokensLoading } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/supplier-portal/tokens", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/supplier-portal/tokens?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: suppliers = [] } = useQuery<any[]>({
    queryKey: ["/api/contacts", selectedCompanyId, "supplier"],
    queryFn: async () => {
      const r = await fetch(`/api/contacts?companyId=${selectedCompanyId}&type=supplier`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: quotes = [], isLoading: quotesLoading } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/supplier-portal/quotes", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/supplier-portal/quotes?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: quoteDetail, isLoading: quoteDetailLoading } = useQuery<any>({
    queryKey: ["/api/ecommerce/supplier-portal/quotes", selectedQuoteId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/supplier-portal/quotes/${selectedQuoteId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedQuoteId,
  });

  const createTokenMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/ecommerce/supplier-portal/tokens", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ ...data, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "สร้างลิงก์สำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/supplier-portal/tokens"] });
      setShowCreateToken(false);
      setTokenForm({ contactId: "", email: "" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const revokeTokenMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/ecommerce/supplier-portal/tokens/${id}?companyId=${selectedCompanyId}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "ยกเลิกลิงก์สำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/supplier-portal/tokens"] });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const reviewQuoteMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const r = await fetch(`/api/ecommerce/supplier-portal/quotes/${id}/review`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ status, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (_, vars) => {
      toast({ title: vars.status === "accepted" ? "อนุมัติใบเสนอราคาสำเร็จ" : "ปฏิเสธใบเสนอราคาสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/supplier-portal/quotes"] });
      setShowQuoteDetail(false);
      setSelectedQuoteId(null);
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const maskToken = (token: string) => {
    if (!token) return "";
    return token.substring(0, 8) + "••••••••" + token.substring(token.length - 4);
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/supplier-portal/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "คัดลอกลิงก์แล้ว", description: url });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs" data-testid={`badge-status-${status}`}>ใช้งาน</Badge>;
      case "expired":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs" data-testid={`badge-status-${status}`}>หมดอายุ</Badge>;
      case "revoked":
        return <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100 text-xs" data-testid={`badge-status-${status}`}>ยกเลิก</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100 text-xs">{status}</Badge>;
    }
  };

  const getQuoteStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 text-xs" data-testid={`badge-quote-status-${status}`}>รอตรวจสอบ</Badge>;
      case "accepted":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs" data-testid={`badge-quote-status-${status}`}>อนุมัติ</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs" data-testid={`badge-quote-status-${status}`}>ปฏิเสธ</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100 text-xs">{status}</Badge>;
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const formatCurrency = (amount: number, currency: string = "THB") => {
    return new Intl.NumberFormat("th-TH", { style: "currency", currency }).format(amount);
  };

  return (
    <EcommerceLayout>
      <div className="space-y-4" data-testid="page-supplier-portal">
        <div>
          <h1 className="text-2xl font-bold text-gray-800" data-testid="text-title">Supplier Portal</h1>
          <p className="text-sm text-muted-foreground mt-0.5">จัดการลิงก์เข้าถึง Supplier Portal และตรวจสอบใบเสนอราคาจาก Supplier</p>
        </div>

        <Tabs defaultValue="links" data-testid="tabs-supplier-portal">
          <TabsList className="grid w-full grid-cols-3" data-testid="tabs-list">
            <TabsTrigger value="links" data-testid="tab-links">
              <Link2 className="h-4 w-4 mr-1.5" />ลิงก์ Supplier
            </TabsTrigger>
            <TabsTrigger value="quotes" data-testid="tab-quotes">
              <FileText className="h-4 w-4 mr-1.5" />ใบเสนอราคา
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">
              <Settings className="h-4 w-4 mr-1.5" />ตั้งค่าพอร์ทัล
            </TabsTrigger>
          </TabsList>

          <TabsContent value="links">
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-[#03c9d7]" />
                    ลิงก์ Supplier ({tokens.length})
                  </CardTitle>
                  <Button
                    className="bg-[#03c9d7] hover:bg-[#02b4c1] text-white gap-1"
                    size="sm"
                    onClick={() => { setTokenForm({ contactId: "", email: "" }); setShowCreateToken(true); }}
                    data-testid="button-create-token"
                  >
                    <Plus className="h-4 w-4" />สร้างลิงก์ใหม่
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {tokensLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : tokens.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Link2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">ยังไม่มีลิงก์ Supplier Portal</p>
                    <p className="text-xs mt-1">กดปุ่ม "สร้างลิงก์ใหม่" เพื่อเชิญ Supplier เข้าสู่ระบบ</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Supplier Name</TableHead>
                        <TableHead className="text-xs">Email</TableHead>
                        <TableHead className="text-xs">Token</TableHead>
                        <TableHead className="text-xs text-center">สถานะ</TableHead>
                        <TableHead className="text-xs">เข้าใช้ล่าสุด</TableHead>
                        <TableHead className="text-xs">วันหมดอายุ</TableHead>
                        <TableHead className="text-xs text-center">เครื่องมือ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tokens.map((t: any) => (
                        <TableRow key={t.id} data-testid={`row-token-${t.id}`}>
                          <TableCell className="text-sm font-medium">{t.supplierName || "-"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{t.email || "-"}</TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">{maskToken(t.token)}</TableCell>
                          <TableCell className="text-center">{getStatusBadge(t.status)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(t.lastAccessedAt)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(t.expiresAt)}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1"
                                onClick={() => copyLink(t.token)}
                                disabled={t.status !== "active"}
                                data-testid={`button-copy-link-${t.id}`}
                              >
                                <Copy className="h-3 w-3" />คัดลอกลิงก์
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 text-red-500 hover:text-red-700"
                                onClick={() => { if (confirm("ต้องการยกเลิกลิงก์นี้?")) revokeTokenMutation.mutate(t.id); }}
                                disabled={t.status !== "active" || revokeTokenMutation.isPending}
                                data-testid={`button-revoke-${t.id}`}
                              >
                                <XCircle className="h-3 w-3" />ยกเลิก
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quotes">
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#03c9d7]" />
                  ใบเสนอราคาจาก Supplier ({quotes.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {quotesLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : quotes.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">ยังไม่มีใบเสนอราคา</p>
                    <p className="text-xs mt-1">Supplier จะยื่นใบเสนอราคาผ่าน Portal</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">เลขที่</TableHead>
                        <TableHead className="text-xs">Supplier</TableHead>
                        <TableHead className="text-xs text-right">จำนวนเงิน</TableHead>
                        <TableHead className="text-xs">สกุลเงิน</TableHead>
                        <TableHead className="text-xs text-center">สถานะ</TableHead>
                        <TableHead className="text-xs">ยื่นเมื่อ</TableHead>
                        <TableHead className="text-xs text-center">เครื่องมือ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quotes.map((q: any) => (
                        <TableRow
                          key={q.id}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => { setSelectedQuoteId(q.id); setShowQuoteDetail(true); }}
                          data-testid={`row-quote-${q.id}`}
                        >
                          <TableCell className="text-sm font-medium">{q.quoteNumber || `QT-${q.id}`}</TableCell>
                          <TableCell className="text-sm">{q.supplierName || "-"}</TableCell>
                          <TableCell className="text-sm text-right font-mono">{formatCurrency(q.totalAmount || 0, q.currency || "THB")}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{q.currency || "THB"}</TableCell>
                          <TableCell className="text-center">{getQuoteStatusBadge(q.status)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(q.submittedAt)}</TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={(e) => { e.stopPropagation(); setSelectedQuoteId(q.id); setShowQuoteDetail(true); }}
                              data-testid={`button-view-quote-${q.id}`}
                            >
                              <Eye className="h-3 w-3" />ดูรายละเอียด
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <div className="space-y-4">
              <Card className="rounded-xl shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Settings className="h-4 w-4 text-[#03c9d7]" />
                    ตั้งค่าพอร์ทัล
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">จำนวนวันหมดอายุเริ่มต้น (วัน)</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        type="number"
                        value={defaultExpiryDays}
                        onChange={e => setDefaultExpiryDays(e.target.value)}
                        className="w-32"
                        min="1"
                        max="365"
                        data-testid="input-default-expiry-days"
                      />
                      <span className="text-sm text-muted-foreground">วัน</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">ลิงก์ Supplier Portal จะหมดอายุหลังจากจำนวนวันที่กำหนด</p>
                  </div>
                  <Button
                    className="bg-[#fb9678] hover:bg-[#e8875a] text-white"
                    onClick={() => toast({ title: "บันทึกการตั้งค่าสำเร็จ" })}
                    data-testid="button-save-settings"
                  >
                    บันทึกการตั้งค่า
                  </Button>
                </CardContent>
              </Card>

              <Card className="rounded-xl shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Globe className="h-4 w-4 text-[#03c9d7]" />
                    เกี่ยวกับ Supplier Portal
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-3">
                  <p>Supplier Portal ช่วยให้คุณเชื่อมต่อกับ Supplier ได้อย่างมีประสิทธิภาพ โดย Supplier สามารถ:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-start gap-2 p-3 bg-green-50 rounded-lg">
                      <ClipboardList className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-green-700 text-sm">ดูรายการสั่งซื้อ</p>
                        <p className="text-xs text-green-600 mt-0.5">ดูรายการสินค้าที่ต้องจัดส่ง</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                      <FileText className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-blue-700 text-sm">ยื่นใบเสนอราคา</p>
                        <p className="text-xs text-blue-600 mt-0.5">ส่งราคาและเงื่อนไขเพื่อพิจารณา</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 bg-purple-50 rounded-lg">
                      <ShieldCheck className="h-5 w-5 text-purple-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-purple-700 text-sm">ความปลอดภัย</p>
                        <p className="text-xs text-purple-600 mt-0.5">ลิงก์มีวันหมดอายุ สามารถยกเลิกได้ทุกเมื่อ</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 bg-orange-50 rounded-lg">
                      <Users className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-orange-700 text-sm">จัดการง่าย</p>
                        <p className="text-xs text-orange-600 mt-0.5">ไม่ต้องสร้างบัญชี ใช้ลิงก์เข้าถึงได้เลย</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Eye className="h-4 w-4 text-[#03c9d7]" />
                    ตัวอย่างหน้า Supplier Portal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-[#fb9678] px-4 py-3 flex items-center gap-2">
                      <Globe className="h-5 w-5 text-white" />
                      <span className="text-white font-bold text-sm">Supplier Portal</span>
                    </div>
                    <div className="p-4 bg-gray-50 space-y-3">
                      <div className="bg-white rounded-lg p-3 shadow-sm border">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="h-4 w-4 text-[#03c9d7]" />
                          <span className="text-sm font-medium">ข้อมูล Supplier</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div>ชื่อบริษัท: <span className="text-gray-700">ตัวอย่าง Supplier Co.</span></div>
                          <div>อีเมล: <span className="text-gray-700">supplier@example.com</span></div>
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3 shadow-sm border">
                        <div className="flex items-center gap-2 mb-2">
                          <ClipboardList className="h-4 w-4 text-[#03c9d7]" />
                          <span className="text-sm font-medium">รายการสินค้าที่ต้องการ</span>
                        </div>
                        <div className="space-y-1">
                          {[
                            { name: "สินค้า A", qty: "100 ชิ้น" },
                            { name: "สินค้า B", qty: "200 ชิ้น" },
                            { name: "สินค้า C", qty: "50 ชิ้น" },
                          ].map((item, i) => (
                            <div key={i} className="flex justify-between text-xs py-1 border-b last:border-0">
                              <span className="text-gray-700">{item.name}</span>
                              <span className="text-muted-foreground">{item.qty}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="bg-[#03c9d7] text-white text-xs px-3 py-1.5 rounded-md font-medium">ยื่นใบเสนอราคา</div>
                        <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1.5 rounded-md font-medium">ดูประวัติ</div>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">ตัวอย่างหน้าจอที่ Supplier จะเห็นเมื่อเข้าถึงผ่านลิงก์</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={showCreateToken} onOpenChange={setShowCreateToken}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>สร้างลิงก์ Supplier Portal ใหม่</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">เลือก Supplier *</label>
                <Select value={tokenForm.contactId} onValueChange={v => setTokenForm(f => ({ ...f, contactId: v }))}>
                  <SelectTrigger className="mt-1" data-testid="select-supplier">
                    <SelectValue placeholder="เลือก Supplier..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)} data-testid={`option-supplier-${s.id}`}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-1"><Mail className="h-3.5 w-3.5" />อีเมล Supplier</label>
                <Input
                  type="email"
                  value={tokenForm.email}
                  onChange={e => setTokenForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="supplier@example.com"
                  className="mt-1"
                  data-testid="input-supplier-email"
                />
              </div>
              <Button
                className="w-full bg-[#03c9d7] hover:bg-[#02b4c1] text-white"
                disabled={!tokenForm.contactId || createTokenMutation.isPending}
                onClick={() => createTokenMutation.mutate(tokenForm)}
                data-testid="button-submit-create-token"
              >
                {createTokenMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                สร้างลิงก์
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showQuoteDetail} onOpenChange={(open) => { setShowQuoteDetail(open); if (!open) setSelectedQuoteId(null); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>รายละเอียดใบเสนอราคา {quoteDetail?.quoteNumber || ""}</DialogTitle>
            </DialogHeader>
            {quoteDetailLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : quoteDetail ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Supplier:</span> <span className="font-medium">{quoteDetail.supplierName}</span></div>
                  <div><span className="text-muted-foreground">สถานะ:</span> {getQuoteStatusBadge(quoteDetail.status)}</div>
                  <div><span className="text-muted-foreground">จำนวนเงินรวม:</span> <span className="font-medium">{formatCurrency(quoteDetail.totalAmount || 0, quoteDetail.currency || "THB")}</span></div>
                  <div><span className="text-muted-foreground">ยื่นเมื่อ:</span> <span>{formatDate(quoteDetail.submittedAt)}</span></div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">รายการสินค้า</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">สินค้า</TableHead>
                        <TableHead className="text-xs">SKU</TableHead>
                        <TableHead className="text-xs text-right">จำนวน</TableHead>
                        <TableHead className="text-xs text-right">ราคาต่อหน่วย</TableHead>
                        <TableHead className="text-xs text-right">ราคารวม</TableHead>
                        <TableHead className="text-xs">Lead Time</TableHead>
                        <TableHead className="text-xs">หมายเหตุ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(quoteDetail.items || []).map((item: any, idx: number) => (
                        <TableRow key={idx} data-testid={`row-quote-item-${idx}`}>
                          <TableCell className="text-sm">{item.productName}</TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">{item.sku || "-"}</TableCell>
                          <TableCell className="text-sm text-right">{item.quantity}</TableCell>
                          <TableCell className="text-sm text-right font-mono">{formatCurrency(item.unitPrice || 0, quoteDetail.currency || "THB")}</TableCell>
                          <TableCell className="text-sm text-right font-mono">{formatCurrency((item.quantity || 0) * (item.unitPrice || 0), quoteDetail.currency || "THB")}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.leadTime || "-"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.notes || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {quoteDetail.status === "pending" && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-1"
                      onClick={() => reviewQuoteMutation.mutate({ id: quoteDetail.id, status: "accepted" })}
                      disabled={reviewQuoteMutation.isPending}
                      data-testid="button-approve-quote"
                    >
                      {reviewQuoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      อนุมัติ
                    </Button>
                    <Button
                      className="flex-1 gap-1"
                      variant="destructive"
                      onClick={() => reviewQuoteMutation.mutate({ id: quoteDetail.id, status: "rejected" })}
                      disabled={reviewQuoteMutation.isPending}
                      data-testid="button-reject-quote"
                    >
                      {reviewQuoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      ปฏิเสธ
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </EcommerceLayout>
  );
}
