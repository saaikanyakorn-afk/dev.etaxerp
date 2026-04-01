import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import EcommerceLayout from "@/components/ecommerce-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useCompany } from "@/lib/company-context";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/format";
import { Facebook, Plus, RefreshCw, Trash2, Eye, Check, X, MessageSquare, Send, Settings, Edit, Info, Upload, CreditCard, ShieldCheck, ShieldX, AlertTriangle, Image } from "lucide-react";

import { useDateSettings } from "@/hooks/use-date-settings";
interface FacebookPage {
  id: number;
  companyId: number;
  pageId: string;
  pageName: string;
  cfKeywords: string;
  status: string;
  lastSyncAt: string | null;
  createdAt: string;
}

interface ParsedProduct {
  name: string;
  qty: number;
  price: number;
}

interface ChatOrder {
  id: number;
  companyId: number;
  pageId: number;
  pageName: string;
  senderName: string;
  rawMessages: string;
  parsedProducts: string;
  totalAmount: string;
  status: string;
  paymentStatus?: string;
  paymentSlipUrl?: string;
  paymentAmount?: string;
  paymentBank?: string;
  paymentRef?: string;
  paymentDate?: string;
  paymentVerifiedAt?: string;
  paymentVerifyNote?: string;
  notes?: string;
  messageDate: string | null;
  createdAt: string;
}

export default function EcommerceFacebookOrders() {
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
  const [addPageOpen, setAddPageOpen] = useState(false);
  const [editPageOpen, setEditPageOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<FacebookPage | null>(null);
  const [pageName, setPageName] = useState("");
  const [pageId, setPageId] = useState("");
  const [pageAccessToken, setPageAccessToken] = useState("");
  const [cfKeywords, setCfKeywords] = useState("CF,cf,ซีเอฟ,สั่ง,จอง");

  const [selectedPageDbId, setSelectedPageDbId] = useState<number>(0);
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [chatMessages, setChatMessages] = useState("");
  const [parseResult, setParseResult] = useState<{ chatOrderId: number; products: ParsedProduct[]; totalAmount: number } | null>(null);
  const [addressInput, setAddressInput] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMsgOpen, setViewMsgOpen] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<ChatOrder | null>(null);
  const [slipUploadOpen, setSlipUploadOpen] = useState(false);
  const [slipUploadOrderId, setSlipUploadOrderId] = useState<number | null>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string>("");
  const [verifyResult, setVerifyResult] = useState<any>(null);

  const { data: pages = [], isLoading: pagesLoading } = useQuery<FacebookPage[]>({
    queryKey: ["/api/facebook/pages", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/facebook/pages?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: chatOrders = [], isLoading: ordersLoading } = useQuery<ChatOrder[]>({
    queryKey: ["/api/facebook/chat-orders", selectedCompanyId, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ companyId: String(selectedCompanyId) });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const r = await fetch(`/api/facebook/chat-orders?${params}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const addPageMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/facebook/pages", {
        companyId: selectedCompanyId,
        pageId,
        pageName,
        pageAccessToken: pageAccessToken || undefined,
        cfKeywords: cfKeywords || "CF,cf,ซีเอฟ,สั่ง,จอง",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/facebook/pages"] });
      setAddPageOpen(false);
      resetPageForm();
      toast({ title: "เพิ่มเพจสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const editPageMutation = useMutation({
    mutationFn: async () => {
      if (!editingPage) return;
      await apiRequest("PATCH", `/api/facebook/pages/${editingPage.id}`, {
        pageName,
        pageAccessToken: pageAccessToken || undefined,
        cfKeywords,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/facebook/pages"] });
      setEditPageOpen(false);
      setEditingPage(null);
      resetPageForm();
      toast({ title: "แก้ไขเพจสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deletePageMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/facebook/pages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/facebook/pages"] });
      toast({ title: "ลบเพจสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const syncPageMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/facebook/pages/${id}/sync`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/facebook/pages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/facebook/chat-orders"] });
      toast({ title: "ซิงค์ข้อมูลจาก Facebook สำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const parseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/facebook/parse-messages", {
        companyId: selectedCompanyId,
        pageId: selectedPageDbId,
        senderName,
        senderPhone: senderPhone || undefined,
        messages: chatMessages,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      const products: ParsedProduct[] = data.products || JSON.parse(data.parsedProducts || "[]");
      setParseResult({ chatOrderId: data.id, products, totalAmount: Number(data.totalAmount) || 0 });
      toast({ title: "วิเคราะห์ข้อความสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const confirmOrderMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/facebook/chat-orders/${id}/confirm`, { address: addressInput || undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/facebook/chat-orders"] });
      setParseResult(null);
      setChatMessages("");
      setSenderName("");
      setSenderPhone("");
      setAddressInput("");
      toast({ title: "ยืนยันออเดอร์สำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const rejectOrderMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/facebook/chat-orders/${id}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/facebook/chat-orders"] });
      toast({ title: "ปฏิเสธออเดอร์แล้ว", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const slipUploadMutation = useMutation({
    mutationFn: async (orderId: number) => {
      if (!slipFile) throw new Error("กรุณาเลือกรูปสลิป");
      const formData = new FormData();
      formData.append("slip", slipFile);
      const res = await fetch(`/api/facebook/chat-orders/${orderId}/upload-slip`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "อัพโหลดสลิปไม่สำเร็จ");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/facebook/chat-orders"] });
      setVerifyResult(data.verification);
      if (data.verification?.match) {
        toast({ title: "ตรวจสลิปสำเร็จ - ยอดตรงกัน", description: "ระบบยืนยันออเดอร์อัตโนมัติแล้ว", variant: "success" as any });
      } else {
        toast({ title: "ตรวจสลิปเสร็จ - ยอดไม่ตรง", description: "กรุณาตรวจสอบด้วยตนเอง", variant: "destructive" });
      }
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const manualVerifyMutation = useMutation({
    mutationFn: async ({ orderId, action, reason }: { orderId: number; action: "approve" | "reject"; reason?: string }) => {
      const res = await apiRequest("PATCH", `/api/facebook/chat-orders/${orderId}/verify-payment`, { action, reason });
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/facebook/chat-orders"] });
      setSlipUploadOpen(false);
      setVerifyResult(null);
      toast({
        title: vars.action === "approve" ? "อนุมัติการชำระเงินแล้ว" : "ปฏิเสธการชำระเงิน",
        variant: vars.action === "approve" ? "success" as any : "destructive",
      });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  function openSlipUpload(orderId: number) {
    setSlipUploadOrderId(orderId);
    setSlipFile(null);
    setSlipPreview("");
    setVerifyResult(null);
    setSlipUploadOpen(true);
  }

  function handleSlipFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setSlipFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setSlipPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  }

  function resetPageForm() {
    setPageName("");
    setPageId("");
    setPageAccessToken("");
    setCfKeywords("CF,cf,ซีเอฟ,สั่ง,จอง");
  }

  function openEditPage(page: FacebookPage) {
    setEditingPage(page);
    setPageName(page.pageName);
    setPageAccessToken("");
    setCfKeywords(page.cfKeywords || "CF,cf,ซีเอฟ,สั่ง,จอง");
    setEditPageOpen(true);
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">เชื่อมต่อแล้ว</Badge>;
      case "confirmed":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">ยืนยันแล้ว</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">รอดำเนินการ</Badge>;
      case "pending_payment":
        return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">รอชำระเงิน</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">ปฏิเสธ</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">{status}</Badge>;
    }
  };

  const paymentStatusBadge = (status?: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100"><ShieldCheck className="h-3 w-3 mr-1" />ชำระแล้ว</Badge>;
      case "needs_review":
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100"><AlertTriangle className="h-3 w-3 mr-1" />ต้องตรวจสอบ</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100"><ShieldX className="h-3 w-3 mr-1" />สลิปไม่ผ่าน</Badge>;
      case "pending":
        return <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100"><CreditCard className="h-3 w-3 mr-1" />รอสลิป</Badge>;
      default:
        return null;
    }
  };

  return (
    <EcommerceLayout>
      <div className="space-y-6" data-testid="page-facebook-orders">
        <div>
          <h1 className="text-2xl font-bold text-gray-800" data-testid="text-facebook-orders-title">
            <Facebook className="h-6 w-6 inline mr-2" style={{ color: "#539BFF" }} />
            ดูดออเดอร์จากแชท Facebook
          </h1>
          <p className="text-sm text-muted-foreground mt-1">วิเคราะห์ข้อความ CF จากแชทของลูกค้าแล้วสร้างออเดอร์อัตโนมัติ</p>
        </div>

        <div className="flex items-start gap-2 p-4 rounded-lg border" style={{ background: "#EBF2FF", borderColor: "#539BFF30" }} data-testid="info-box-facebook">
          <Info className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "#539BFF" }} />
          <p className="text-sm" style={{ color: "#3B7BDB" }}>
            ระบบดูดออเดอร์จากแชท Facebook - วิเคราะห์ข้อความ CF จากแชทของลูกค้าแล้วสร้างออเดอร์อัตโนมัติ รองรับทั้งการเชื่อมต่อ Facebook Graph API โดยตรง หรือวางข้อความแชทด้วยตนเอง
          </p>
        </div>

        <Tabs defaultValue="pages" data-testid="tabs-facebook-orders">
          <TabsList>
            <TabsTrigger value="pages" data-testid="tab-facebook-pages">
              <Settings className="h-4 w-4 mr-1.5" />
              เพจ Facebook
            </TabsTrigger>
            <TabsTrigger value="paste" data-testid="tab-paste-cf">
              <MessageSquare className="h-4 w-4 mr-1.5" />
              วางข้อความ CF
            </TabsTrigger>
            <TabsTrigger value="orders" data-testid="tab-chat-orders">
              <Facebook className="h-4 w-4 mr-1.5" />
              ออเดอร์จากแชท
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Facebook Pages */}
          <TabsContent value="pages" className="mt-4">
            <div className="flexy-card p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">เพจ Facebook ที่เชื่อมต่อ</h2>
                <Button
                  onClick={() => { resetPageForm(); setAddPageOpen(true); }}
                  style={{ background: "#539BFF" }}
                  className="text-white hover:opacity-90"
                  data-testid="button-add-page"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  เพิ่มเพจ
                </Button>
              </div>

              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#539BFF" }} />
                <p className="text-xs text-blue-700">
                  เพื่อเชื่อมต่อ Facebook ต้องมี Facebook App + Page Access Token (ดู Graph API Explorer)
                </p>
              </div>

              {pagesLoading ? (
                <div className="flex justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#539BFF]" />
                </div>
              ) : pages.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground" data-testid="text-no-pages">
                  <Facebook className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-sm">ยังไม่มีเพจ Facebook ที่เชื่อมต่อ</p>
                  <p className="text-xs mt-1">กดปุ่ม "เพิ่มเพจ" เพื่อเริ่มต้นใช้งาน</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left py-3 px-2 font-medium">ชื่อเพจ</th>
                        <th className="text-left py-3 px-2 font-medium">Page ID</th>
                        <th className="text-center py-3 px-2 font-medium">สถานะ</th>
                        <th className="text-left py-3 px-2 font-medium">ซิงค์ล่าสุด</th>
                        <th className="text-left py-3 px-2 font-medium">CF Keywords</th>
                        <th className="text-right py-3 px-2 font-medium">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pages.map((p) => (
                        <tr key={p.id} className="border-b hover:bg-gray-50/50" data-testid={`row-page-${p.id}`}>
                          <td className="py-3 px-2 font-medium" data-testid={`text-page-name-${p.id}`}>{p.pageName}</td>
                          <td className="py-3 px-2">
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono" data-testid={`text-page-id-${p.id}`}>{p.pageId}</code>
                          </td>
                          <td className="py-3 px-2 text-center" data-testid={`badge-page-status-${p.id}`}>
                            {statusBadge(p.status)}
                          </td>
                          <td className="py-3 px-2 text-xs text-muted-foreground" data-testid={`text-page-sync-${p.id}`}>
                            {formatDateTime(p.lastSyncAt, dateEra, dateFmt)}
                          </td>
                          <td className="py-3 px-2">
                            <span className="text-xs text-muted-foreground" data-testid={`text-page-keywords-${p.id}`}>{p.cfKeywords}</span>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => openEditPage(p)}
                                data-testid={`button-edit-page-${p.id}`}
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                แก้ไข
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                                onClick={() => syncPageMutation.mutate(p.id)}
                                disabled={syncPageMutation.isPending}
                                data-testid={`button-sync-page-${p.id}`}
                              >
                                <RefreshCw className={`h-3 w-3 mr-1 ${syncPageMutation.isPending ? "animate-spin" : ""}`} />
                                ซิงค์
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => deletePageMutation.mutate(p.id)}
                                disabled={deletePageMutation.isPending}
                                data-testid={`button-delete-page-${p.id}`}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                ลบ
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab 2: Paste CF Messages */}
          <TabsContent value="paste" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="flexy-card p-6 space-y-4">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" style={{ color: "#539BFF" }} />
                  วางข้อความ CF จากแชท
                </h2>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">เลือกเพจ Facebook</label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={selectedPageDbId}
                    onChange={(e) => setSelectedPageDbId(Number(e.target.value))}
                    data-testid="select-page"
                  >
                    <option value="0">-- เลือกเพจ --</option>
                    {pages.map((p) => (
                      <option key={p.id} value={p.id}>{p.pageName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">ชื่อลูกค้า</label>
                  <Input
                    placeholder="ชื่อลูกค้าจากแชท"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    data-testid="input-sender-name"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">เบอร์โทร (ไม่บังคับ)</label>
                  <Input
                    placeholder="0812345678"
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    data-testid="input-sender-phone"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">วางข้อความแชท</label>
                  <Textarea
                    placeholder={`CF เสื้อยืดสีขาว 2 ตัว 250\nCF กางเกงยีนส์ 1 ตัว 590\nสั่ง หมวกแก๊ป x3 @150`}
                    rows={8}
                    value={chatMessages}
                    onChange={(e) => setChatMessages(e.target.value)}
                    data-testid="textarea-chat-messages"
                  />
                </div>

                <Button
                  onClick={() => parseMutation.mutate()}
                  disabled={!selectedPageDbId || !senderName.trim() || !chatMessages.trim() || parseMutation.isPending}
                  style={{ background: "#539BFF" }}
                  className="w-full text-white hover:opacity-90"
                  data-testid="button-parse-messages"
                >
                  {parseMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-1.5" />
                  )}
                  วิเคราะห์ข้อความ
                </Button>
              </div>

              <div className="flexy-card p-6 space-y-4">
                <h2 className="text-lg font-semibold text-gray-800">ผลการวิเคราะห์</h2>

                {!parseResult ? (
                  <div className="py-12 text-center text-muted-foreground" data-testid="text-no-parse-result">
                    <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-sm">วางข้อความแชทแล้วกด "วิเคราะห์ข้อความ"</p>
                    <p className="text-xs mt-1">ระบบจะแยกรายการสินค้าจากข้อความ CF อัตโนมัติ</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" data-testid="table-parsed-items">
                        <thead>
                          <tr className="border-b text-xs text-muted-foreground">
                            <th className="text-left py-2 px-2 font-medium">สินค้า</th>
                            <th className="text-center py-2 px-2 font-medium">จำนวน</th>
                            <th className="text-right py-2 px-2 font-medium">ราคา</th>
                            <th className="text-right py-2 px-2 font-medium">รวม</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parseResult.products.map((item, idx) => (
                            <tr key={idx} className="border-b" data-testid={`row-parsed-item-${idx}`}>
                              <td className="py-2 px-2" data-testid={`text-parsed-product-${idx}`}>{item.name}</td>
                              <td className="py-2 px-2 text-center" data-testid={`text-parsed-qty-${idx}`}>{item.qty}</td>
                              <td className="py-2 px-2 text-right" data-testid={`text-parsed-price-${idx}`}>{item.price.toLocaleString()}</td>
                              <td className="py-2 px-2 text-right font-medium" data-testid={`text-parsed-total-${idx}`}>{(item.qty * item.price).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "#E8F5E9" }}>
                      <span className="text-sm font-medium text-gray-700">ยอดรวมทั้งหมด</span>
                      <span className="text-lg font-bold" style={{ color: "#05b187" }} data-testid="text-parse-total-amount">
                        ฿{parseResult.totalAmount.toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">ที่อยู่จัดส่ง (ไม่บังคับ)</label>
                      <Textarea
                        placeholder="ที่อยู่สำหรับจัดส่งสินค้า"
                        rows={3}
                        value={addressInput}
                        onChange={(e) => setAddressInput(e.target.value)}
                        data-testid="textarea-address"
                      />
                    </div>

                    <Button
                      onClick={() => {
                        if (parseResult?.chatOrderId) {
                          confirmOrderMutation.mutate(parseResult.chatOrderId);
                        }
                      }}
                      disabled={!parseResult?.chatOrderId || confirmOrderMutation.isPending}
                      style={{ background: "#05b187" }}
                      className="w-full text-white hover:opacity-90"
                      data-testid="button-confirm-create-order"
                    >
                      {confirmOrderMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-1.5" />
                      )}
                      ยืนยันสร้างออเดอร์
                    </Button>
                  </>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Tab 3: Chat Orders */}
          <TabsContent value="orders" className="mt-4">
            <div className="flexy-card p-6 space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-lg font-semibold text-gray-800">ออเดอร์จากแชท Facebook</h2>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground">สถานะ:</label>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    data-testid="select-status-filter"
                  >
                    <option value="all">ทั้งหมด</option>
                    <option value="pending">รอดำเนินการ</option>
                    <option value="pending_payment">รอชำระเงิน</option>
                    <option value="confirmed">ยืนยันแล้ว</option>
                    <option value="rejected">ปฏิเสธ</option>
                  </select>
                </div>
              </div>

              {ordersLoading ? (
                <div className="flex justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#539BFF]" />
                </div>
              ) : chatOrders.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground" data-testid="text-no-chat-orders">
                  <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-sm">ยังไม่มีออเดอร์จากแชท</p>
                  <p className="text-xs mt-1">ไปที่แท็บ "วางข้อความ CF" เพื่อเริ่มวิเคราะห์ข้อความ</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left py-3 px-2 font-medium">ชื่อลูกค้า</th>
                        <th className="text-left py-3 px-2 font-medium">รายการสินค้า</th>
                        <th className="text-right py-3 px-2 font-medium">ยอดรวม</th>
                        <th className="text-center py-3 px-2 font-medium">สถานะ</th>
                        <th className="text-center py-3 px-2 font-medium">การชำระ</th>
                        <th className="text-left py-3 px-2 font-medium">วันที่</th>
                        <th className="text-right py-3 px-2 font-medium">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chatOrders.map((order) => (
                        <tr key={order.id} className="border-b hover:bg-gray-50/50" data-testid={`row-chat-order-${order.id}`}>
                          <td className="py-3 px-2 font-medium" data-testid={`text-order-sender-${order.id}`}>
                            <div className="flex items-center gap-1.5">
                              <Facebook className="h-3.5 w-3.5 shrink-0" style={{ color: "#539BFF" }} />
                              <div>
                                {order.senderName}
                                {order.pageName && (
                                  <span className="text-xs text-muted-foreground block">{order.pageName}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-xs text-muted-foreground max-w-[200px] truncate" data-testid={`text-order-items-${order.id}`}>
                            {(() => {
                              try {
                                const items: ParsedProduct[] = JSON.parse(order.parsedProducts || "[]");
                                return items.map((i) => `${i.name} x${i.qty}`).join(", ");
                              } catch { return "-"; }
                            })()}
                          </td>
                          <td className="py-3 px-2 text-right font-medium" data-testid={`text-order-total-${order.id}`}>
                            ฿{Number(order.totalAmount || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-2 text-center" data-testid={`badge-order-status-${order.id}`}>
                            {statusBadge(order.status)}
                          </td>
                          <td className="py-3 px-2 text-center" data-testid={`badge-payment-status-${order.id}`}>
                            {order.status === "pending_payment" || order.status === "confirmed"
                              ? paymentStatusBadge(order.paymentStatus)
                              : <span className="text-xs text-muted-foreground">-</span>
                            }
                          </td>
                          <td className="py-3 px-2 text-xs text-muted-foreground" data-testid={`text-order-date-${order.id}`}>
                            {formatDateTime(order.createdAt, dateEra, dateFmt)}
                          </td>
                          <td className="py-3 px-2 text-right">
                            <div className="flex items-center justify-end gap-1 flex-wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => { setViewingOrder(order); setViewMsgOpen(true); }}
                                data-testid={`button-view-msg-${order.id}`}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                ดูข้อความ
                              </Button>
                              {order.status === "pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs text-orange-600 border-orange-200 hover:bg-orange-50"
                                    onClick={() => confirmOrderMutation.mutate(order.id)}
                                    disabled={confirmOrderMutation.isPending}
                                    data-testid={`button-confirm-order-${order.id}`}
                                  >
                                    <CreditCard className="h-3 w-3 mr-1" />
                                    รอชำระ
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={() => rejectOrderMutation.mutate(order.id)}
                                    disabled={rejectOrderMutation.isPending}
                                    data-testid={`button-reject-order-${order.id}`}
                                  >
                                    <X className="h-3 w-3 mr-1" />
                                    ปฏิเสธ
                                  </Button>
                                </>
                              )}
                              {order.status === "pending_payment" && order.paymentStatus === "pending" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                                  onClick={() => openSlipUpload(order.id)}
                                  data-testid={`button-upload-slip-${order.id}`}
                                >
                                  <Upload className="h-3 w-3 mr-1" />
                                  อัพโหลดสลิป
                                </Button>
                              )}
                              {order.paymentStatus === "needs_review" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-amber-600 border-amber-200 hover:bg-amber-50"
                                  onClick={() => openSlipUpload(order.id)}
                                  data-testid={`button-review-slip-${order.id}`}
                                >
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  ตรวจสลิป
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Add Page Dialog */}
        <Dialog open={addPageOpen} onOpenChange={setAddPageOpen}>
          <DialogContent className="max-w-md" data-testid="dialog-add-page">
            <DialogHeader>
              <DialogTitle>เพิ่มเพจ Facebook</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">ชื่อเพจ *</label>
                <Input
                  placeholder="เช่น ร้านค้าออนไลน์ ABC"
                  value={pageName}
                  onChange={(e) => setPageName(e.target.value)}
                  data-testid="input-page-name"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Page ID *</label>
                <Input
                  placeholder="เช่น 123456789012345"
                  value={pageId}
                  onChange={(e) => setPageId(e.target.value)}
                  data-testid="input-page-id"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Page Access Token (ไม่บังคับ)</label>
                <Input
                  placeholder="EAAxxxxxxxx..."
                  value={pageAccessToken}
                  onChange={(e) => setPageAccessToken(e.target.value)}
                  data-testid="input-page-access-token"
                />
                <p className="text-xs text-muted-foreground mt-1">ใช้สำหรับเชื่อมต่อ Facebook Graph API ดูดข้อมูลอัตโนมัติ</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">CF Keywords</label>
                <Input
                  placeholder="CF,cf,ซีเอฟ,สั่ง,จอง"
                  value={cfKeywords}
                  onChange={(e) => setCfKeywords(e.target.value)}
                  data-testid="input-cf-keywords"
                />
                <p className="text-xs text-muted-foreground mt-1">คำที่ใช้ตรวจจับข้อความสั่งซื้อ คั่นด้วยเครื่องหมายจุลภาค</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAddPageOpen(false)} data-testid="button-cancel-add-page">
                  ยกเลิก
                </Button>
                <Button
                  onClick={() => addPageMutation.mutate()}
                  disabled={!pageName.trim() || !pageId.trim() || addPageMutation.isPending}
                  style={{ background: "#539BFF" }}
                  className="text-white hover:opacity-90"
                  data-testid="button-confirm-add-page"
                >
                  {addPageMutation.isPending ? "กำลังเพิ่ม..." : "เพิ่มเพจ"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Page Dialog */}
        <Dialog open={editPageOpen} onOpenChange={setEditPageOpen}>
          <DialogContent className="max-w-md" data-testid="dialog-edit-page">
            <DialogHeader>
              <DialogTitle>แก้ไขเพจ Facebook</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">ชื่อเพจ</label>
                <Input
                  value={pageName}
                  onChange={(e) => setPageName(e.target.value)}
                  data-testid="input-edit-page-name"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Page Access Token</label>
                <Input
                  placeholder="EAAxxxxxxxx..."
                  value={pageAccessToken}
                  onChange={(e) => setPageAccessToken(e.target.value)}
                  data-testid="input-edit-page-access-token"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">CF Keywords</label>
                <Input
                  value={cfKeywords}
                  onChange={(e) => setCfKeywords(e.target.value)}
                  data-testid="input-edit-cf-keywords"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditPageOpen(false)} data-testid="button-cancel-edit-page">
                  ยกเลิก
                </Button>
                <Button
                  onClick={() => editPageMutation.mutate()}
                  disabled={!pageName.trim() || editPageMutation.isPending}
                  style={{ background: "#fb9678" }}
                  className="text-white hover:opacity-90"
                  data-testid="button-confirm-edit-page"
                >
                  {editPageMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Slip Upload & Verify Dialog */}
        <Dialog open={slipUploadOpen} onOpenChange={(open) => { if (!open) { setSlipUploadOpen(false); setVerifyResult(null); } }}>
          <DialogContent className="max-w-lg" data-testid="dialog-slip-upload">
            <DialogHeader>
              <DialogTitle>
                <CreditCard className="h-5 w-5 inline mr-2" style={{ color: "#fb9678" }} />
                ตรวจสอบการชำระเงิน
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {!verifyResult ? (
                <>
                  <div className="p-3 rounded-lg border" style={{ background: "#FFF8E1", borderColor: "#FFD54F50" }}>
                    <p className="text-sm" style={{ color: "#F57F17" }}>
                      อัพโหลดรูปสลิปโอนเงิน ระบบ AI จะอ่านยอดเงิน ธนาคาร และเลขอ้างอิงอัตโนมัติ แล้วเทียบกับยอดออเดอร์
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">เลือกรูปสลิปโอนเงิน</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSlipFileChange}
                      className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-[#fb9678]/10 file:text-[#fb9678] hover:file:bg-[#fb9678]/20"
                      data-testid="input-slip-file"
                    />
                  </div>

                  {slipPreview && (
                    <div className="relative">
                      <img src={slipPreview} alt="สลิปโอนเงิน" className="w-full max-h-[300px] object-contain rounded-lg border" data-testid="img-slip-preview" />
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setSlipUploadOpen(false)} data-testid="button-cancel-slip">
                      ยกเลิก
                    </Button>
                    <Button
                      onClick={() => slipUploadOrderId && slipUploadMutation.mutate(slipUploadOrderId)}
                      disabled={!slipFile || slipUploadMutation.isPending}
                      style={{ background: "#fb9678" }}
                      className="text-white hover:opacity-90"
                      data-testid="button-submit-slip"
                    >
                      {slipUploadMutation.isPending ? (
                        <><RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />AI กำลังตรวจสลิป...</>
                      ) : (
                        <><Upload className="h-4 w-4 mr-1.5" />อัพโหลด + ตรวจอัตโนมัติ</>
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className={`p-4 rounded-lg border ${verifyResult.match ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
                    <div className="flex items-start gap-3">
                      {verifyResult.match ? (
                        <ShieldCheck className="h-8 w-8 text-green-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-8 w-8 text-amber-600 shrink-0" />
                      )}
                      <div>
                        <h4 className={`font-semibold ${verifyResult.match ? "text-green-700" : "text-amber-700"}`}>
                          {verifyResult.match ? "ยอดตรงกัน - ยืนยันอัตโนมัติแล้ว" : "ยอดไม่ตรง - กรุณาตรวจสอบ"}
                        </h4>
                        <p className="text-sm mt-1 text-gray-600" data-testid="text-verify-note">{verifyResult.note}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 rounded-lg bg-gray-50 border">
                      <span className="text-xs text-muted-foreground block">ยอดในสลิป</span>
                      <span className="font-bold text-lg" data-testid="text-slip-amount">฿{Number(verifyResult.amount || 0).toLocaleString()}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-50 border">
                      <span className="text-xs text-muted-foreground block">ธนาคาร</span>
                      <span className="font-medium" data-testid="text-slip-bank">{verifyResult.bank || "-"}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-50 border">
                      <span className="text-xs text-muted-foreground block">เลขอ้างอิง</span>
                      <span className="font-medium text-xs" data-testid="text-slip-ref">{verifyResult.ref || "-"}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-50 border">
                      <span className="text-xs text-muted-foreground block">วันที่โอน</span>
                      <span className="font-medium" data-testid="text-slip-date">{verifyResult.date || "-"}</span>
                    </div>
                  </div>

                  {!verifyResult.match && slipUploadOrderId && (
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => manualVerifyMutation.mutate({ orderId: slipUploadOrderId, action: "reject", reason: "สลิปไม่ถูกต้อง" })}
                        disabled={manualVerifyMutation.isPending}
                        data-testid="button-reject-payment"
                      >
                        <ShieldX className="h-4 w-4 mr-1.5" />
                        ปฏิเสธสลิป
                      </Button>
                      <Button
                        style={{ background: "#05b187" }}
                        className="text-white hover:opacity-90"
                        onClick={() => manualVerifyMutation.mutate({ orderId: slipUploadOrderId, action: "approve" })}
                        disabled={manualVerifyMutation.isPending}
                        data-testid="button-approve-payment"
                      >
                        <ShieldCheck className="h-4 w-4 mr-1.5" />
                        อนุมัติด้วยตนเอง
                      </Button>
                    </div>
                  )}

                  {verifyResult.match && (
                    <div className="flex justify-end">
                      <Button variant="outline" onClick={() => { setSlipUploadOpen(false); setVerifyResult(null); }} data-testid="button-close-verify">
                        ปิด
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* View Messages Dialog */}
        <Dialog open={viewMsgOpen} onOpenChange={setViewMsgOpen}>
          <DialogContent className="max-w-lg" data-testid="dialog-view-messages">
            <DialogHeader>
              <DialogTitle>ข้อความต้นฉบับ</DialogTitle>
            </DialogHeader>
            {viewingOrder && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2">
                  <Badge className="text-white" style={{ background: "#539BFF" }}>
                    <Facebook className="h-3 w-3 mr-1" />
                    Facebook
                  </Badge>
                  <span className="text-sm font-medium">{viewingOrder.senderName}</span>
                  {viewingOrder.pageName && (
                    <span className="text-xs text-muted-foreground">({viewingOrder.pageName})</span>
                  )}
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <pre className="text-sm whitespace-pre-wrap font-sans" data-testid="text-original-messages">
                    {viewingOrder.rawMessages}
                  </pre>
                </div>
                {(() => {
                  try {
                    const items: ParsedProduct[] = JSON.parse(viewingOrder.parsedProducts || "[]");
                    if (items.length === 0) return null;
                    return (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">รายการที่วิเคราะห์ได้:</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b text-xs text-muted-foreground">
                                <th className="text-left py-2 px-2 font-medium">สินค้า</th>
                                <th className="text-center py-2 px-2 font-medium">จำนวน</th>
                                <th className="text-right py-2 px-2 font-medium">ราคา</th>
                                <th className="text-right py-2 px-2 font-medium">รวม</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item, idx) => (
                                <tr key={idx} className="border-b">
                                  <td className="py-2 px-2">{item.name}</td>
                                  <td className="py-2 px-2 text-center">{item.qty}</td>
                                  <td className="py-2 px-2 text-right">{item.price.toLocaleString()}</td>
                                  <td className="py-2 px-2 text-right font-medium">{(item.qty * item.price).toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex justify-end mt-2">
                          <span className="text-sm font-bold" style={{ color: "#05b187" }}>
                            รวม: ฿{Number(viewingOrder.totalAmount || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  } catch { return null; }
                })()}
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => setViewMsgOpen(false)} data-testid="button-close-view-msg">
                    ปิด
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </EcommerceLayout>
  );
}
