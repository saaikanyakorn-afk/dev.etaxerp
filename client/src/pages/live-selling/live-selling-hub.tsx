import { Link } from "wouter";
import EcommerceLayout from "@/components/ecommerce-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Plus, Pencil, Play, Square, Eye, ShoppingCart, CreditCard, Package, Radio, Video, Image as ImageIcon, CheckCircle, XCircle, Trash2, BarChart3, Upload, Loader2, FileCheck, FileText, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@shared/schema";
import { formatDateTime } from "@/lib/format";

import { useDateSettings } from "@/hooks/use-date-settings";
const PLATFORMS = [
  { value: "facebook", label: "Facebook", className: "bg-[#e5f9fa] text-[#03c9d7] hover:bg-[#e5f9fa]" },
  { value: "tiktok", label: "TikTok", className: "bg-pink-100 text-pink-700 hover:bg-pink-100" },
  { value: "instagram", label: "Instagram", className: "bg-purple-100 text-purple-700 hover:bg-purple-100" },
  { value: "other", label: "อื่นๆ", className: "bg-gray-100 text-gray-700 hover:bg-gray-100" },
];

const SESSION_STATUSES: Record<string, { label: string; className: string }> = {
  draft: { label: "แบบร่าง", className: "bg-gray-100 text-gray-700 hover:bg-gray-100" },
  live: { label: "🔴 กำลังไลฟ์", className: "bg-red-100 text-red-600 hover:bg-red-100 animate-pulse" },
  ended: { label: "จบแล้ว", className: "bg-green-100 text-green-700 hover:bg-green-100" },
};

const CF_ORDER_STATUSES = [
  { value: "cf", label: "CF", className: "bg-purple-100 text-purple-700 hover:bg-purple-100" },
  { value: "awaiting_payment", label: "รอชำระ", className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100" },
  { value: "paid", label: "ชำระแล้ว", className: "bg-green-100 text-green-700 hover:bg-green-100" },
  { value: "preparing", label: "กำลังจัดเตรียม", className: "bg-[#e5f9fa] text-[#03c9d7] hover:bg-[#e5f9fa]" },
  { value: "shipped", label: "จัดส่งแล้ว", className: "bg-cyan-100 text-cyan-700 hover:bg-cyan-100" },
  { value: "delivered", label: "ส่งถึงแล้ว", className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" },
  { value: "cancelled", label: "ยกเลิก", className: "bg-red-100 text-red-700 hover:bg-red-100" },
];

const PAYMENT_STATUSES: Record<string, { label: string; className: string }> = {
  pending: { label: "รอตรวจสอบ", className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100" },
  needs_review: { label: "ยอดไม่ตรง", className: "bg-amber-100 text-amber-700 hover:bg-amber-100" },
  verified: { label: "ยืนยันแล้ว", className: "bg-green-100 text-green-700 hover:bg-green-100" },
  rejected: { label: "ปฏิเสธ", className: "bg-red-100 text-red-700 hover:bg-red-100" },
};

const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "โอนธนาคาร" },
  { value: "promptpay", label: "พร้อมเพย์" },
  { value: "cod", label: "เก็บเงินปลายทาง" },
];

type SessionForm = { title: string; platform: string; notes: string };
const emptySessionForm: SessionForm = { title: "", platform: "", notes: "" };

type CFOrderForm = { sessionId: number | ""; customerName: string; phone: string; socialHandle: string; items: { productId: number | ""; quantity: string; price: string }[] };
const emptyCFOrderForm: CFOrderForm = { sessionId: "", customerName: "", phone: "", socialHandle: "", items: [{ productId: "", quantity: "1", price: "" }] };

type PaymentForm = { cfOrderId: number | ""; amount: string; method: string; bankName: string; transferDate: string; slipUrl: string };
const emptyPaymentForm: PaymentForm = { cfOrderId: "", amount: "", method: "", bankName: "", transferDate: "", slipUrl: "" };

type SessionProductForm = { productId: number | ""; cfCode: string; livePrice: string; availableQty: string };
const emptySessionProductForm: SessionProductForm = { productId: "", cfCode: "", livePrice: "", availableQty: "" };

function platformBadge(platform: string) {
  const p = PLATFORMS.find(pl => pl.value === platform);
  if (!p) return <Badge data-testid={`badge-platform-${platform}`} className="bg-gray-100 text-gray-700 hover:bg-gray-100">{platform}</Badge>;
  return <Badge data-testid={`badge-platform-${platform}`} className={p.className}>{p.label}</Badge>;
}

function sessionStatusBadge(status: string) {
  const s = SESSION_STATUSES[status];
  if (!s) return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">{status}</Badge>;
  return <Badge data-testid={`badge-session-status-${status}`} className={s.className}>{s.label}</Badge>;
}

function cfOrderStatusBadge(status: string) {
  const s = CF_ORDER_STATUSES.find(os => os.value === status);
  if (!s) return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">{status}</Badge>;
  return <Badge data-testid={`badge-cf-status-${status}`} className={s.className}>{s.label}</Badge>;
}

function paymentStatusBadge(status: string) {
  const s = PAYMENT_STATUSES[status];
  if (!s) return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">{status}</Badge>;
  return <Badge data-testid={`badge-payment-status-${status}`} className={s.className}>{s.label}</Badge>;
}

function formatCurrency(v: string | number | null | undefined) {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function LiveSellingHub() {
  const { selectedCompanyId } = useCompany();

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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [sessionForm, setSessionForm] = useState<SessionForm>({ ...emptySessionForm });

  const [cfOrderDialogOpen, setCfOrderDialogOpen] = useState(false);
  const [cfOrderForm, setCfOrderForm] = useState<CFOrderForm>({ ...emptyCFOrderForm });
  const [cfOrderDetailOpen, setCfOrderDetailOpen] = useState(false);
  const [selectedCfOrderId, setSelectedCfOrderId] = useState<number | null>(null);
  const [cfSessionFilter, setCfSessionFilter] = useState("all");
  const [cfStatusFilter, setCfStatusFilter] = useState("all");

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({ ...emptyPaymentForm });
  const [slipDialogOpen, setSlipDialogOpen] = useState(false);
  const [slipImageUrl, setSlipImageUrl] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectPaymentId, setRejectPaymentId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [uploadingPaymentId, setUploadingPaymentId] = useState<number | null>(null);
  const [verifyResultDialogOpen, setVerifyResultDialogOpen] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);

  const [sessionProductDialogOpen, setSessionProductDialogOpen] = useState(false);
  const [sessionProductForm, setSessionProductForm] = useState<SessionProductForm>({ ...emptySessionProductForm });
  const [selectedProductSessionId, setSelectedProductSessionId] = useState<number | "">("");

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/products?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<any[]>({
    queryKey: ["/api/live/sessions", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/live/sessions?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: cfOrders = [], isLoading: cfOrdersLoading } = useQuery<any[]>({
    queryKey: ["/api/live/cf-orders", selectedCompanyId, cfSessionFilter, cfStatusFilter],
    queryFn: async () => {
      let url = `/api/live/cf-orders?companyId=${selectedCompanyId}`;
      if (cfSessionFilter !== "all") url += `&sessionId=${cfSessionFilter}`;
      if (cfStatusFilter !== "all") url += `&status=${cfStatusFilter}`;
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: cfOrderItems = [] } = useQuery<any[]>({
    queryKey: ["/api/live/cf-orders", selectedCfOrderId, "items"],
    queryFn: async () => {
      const r = await fetch(`/api/live/cf-orders/${selectedCfOrderId}/items`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCfOrderId && cfOrderDetailOpen,
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery<any[]>({
    queryKey: ["/api/live/payments", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/live/payments?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: sessionProducts = [] } = useQuery<any[]>({
    queryKey: ["/api/live/sessions", selectedProductSessionId, "products"],
    queryFn: async () => {
      const r = await fetch(`/api/live/sessions/${selectedProductSessionId}/products`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedProductSessionId,
  });

  const createSession = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/live/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ...data, companyId: selectedCompanyId }) });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/live/sessions"] }); toast({ title: "สร้างเซสชันสำเร็จ", variant: "success" as any }); resetSessionForm(); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const updateSession = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await fetch(`/api/live/sessions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/live/sessions"] }); toast({ title: "อัปเดตเซสชันสำเร็จ", variant: "success" as any }); resetSessionForm(); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const createCfOrder = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/live/cf-orders", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ...data, companyId: selectedCompanyId }) });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/live/cf-orders"] }); toast({ title: "เพิ่มออเดอร์ CF สำเร็จ", variant: "success" as any }); resetCfOrderForm(); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const updateCfOrder = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await fetch(`/api/live/cf-orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/live/cf-orders"] }); toast({ title: "อัปเดตออเดอร์สำเร็จ", variant: "success" as any }); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const createPayment = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/live/payments", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/live/payments"] }); toast({ title: "เพิ่มข้อมูลการชำระเงินสำเร็จ", variant: "success" as any }); resetPaymentForm(); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const updatePayment = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await fetch(`/api/live/payments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/live/payments"] }); toast({ title: "อัปเดตสถานะการชำระเงินสำเร็จ", variant: "success" as any }); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const createSessionProduct = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch(`/api/live/sessions/${selectedProductSessionId}/products`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/live/sessions", selectedProductSessionId, "products"] }); toast({ title: "เพิ่มสินค้าในเซสชันสำเร็จ", variant: "success" as any }); resetSessionProductForm(); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteSessionProduct = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/live/session-products/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/live/sessions", selectedProductSessionId, "products"] }); toast({ title: "ลบสินค้าออกจากเซสชันสำเร็จ", variant: "success" as any }); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  function resetSessionForm() { setSessionForm({ ...emptySessionForm }); setEditingSessionId(null); setSessionDialogOpen(false); }
  function resetCfOrderForm() { setCfOrderForm({ ...emptyCFOrderForm }); setCfOrderDialogOpen(false); }
  function resetPaymentForm() { setPaymentForm({ ...emptyPaymentForm }); setPaymentDialogOpen(false); }
  function resetSessionProductForm() { setSessionProductForm({ ...emptySessionProductForm }); setSessionProductDialogOpen(false); }

  function handleEditSession(s: any) {
    setEditingSessionId(s.id);
    setSessionForm({ title: s.title, platform: s.platform, notes: s.notes || "" });
    setSessionDialogOpen(true);
  }

  function handleSubmitSession() {
    if (!sessionForm.title || !sessionForm.platform) {
      toast({ title: "กรุณากรอกชื่อเซสชันและเลือกแพลตฟอร์ม", variant: "destructive" });
      return;
    }
    if (editingSessionId) {
      updateSession.mutate({ id: editingSessionId, data: sessionForm });
    } else {
      createSession.mutate(sessionForm);
    }
  }

  function handleStartLive(id: number) {
    updateSession.mutate({ id, data: { status: "live", startTime: new Date().toISOString() } });
  }

  function handleEndLive(id: number) {
    updateSession.mutate({ id, data: { status: "ended", endTime: new Date().toISOString() } });
  }

  function handleSubmitCfOrder() {
    if (!cfOrderForm.sessionId || !cfOrderForm.customerName) {
      toast({ title: "กรุณากรอกข้อมูลให้ครบ", variant: "destructive" });
      return;
    }
    const validItems = cfOrderForm.items.filter(i => i.productId && Number(i.quantity) > 0 && Number(i.price) > 0);
    if (validItems.length === 0) {
      toast({ title: "กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ", variant: "destructive" });
      return;
    }
    const totalAmount = validItems.reduce((sum, i) => sum + Number(i.quantity) * Number(i.price), 0);
    createCfOrder.mutate({
      sessionId: Number(cfOrderForm.sessionId),
      customerName: cfOrderForm.customerName,
      phone: cfOrderForm.phone,
      socialHandle: cfOrderForm.socialHandle,
      totalAmount: totalAmount.toString(),
      items: validItems.map(i => ({ productId: Number(i.productId), quantity: Number(i.quantity), price: Number(i.price) })),
    });
  }

  function handleViewCfOrder(id: number) {
    setSelectedCfOrderId(id);
    setCfOrderDetailOpen(true);
  }

  function handleSubmitPayment() {
    if (!paymentForm.cfOrderId || !paymentForm.amount || !paymentForm.method) {
      toast({ title: "กรุณากรอกข้อมูลให้ครบ", variant: "destructive" });
      return;
    }
    createPayment.mutate({
      cfOrderId: Number(paymentForm.cfOrderId),
      amount: paymentForm.amount,
      method: paymentForm.method,
      bankName: paymentForm.bankName,
      transferDate: paymentForm.transferDate || null,
      slipUrl: paymentForm.slipUrl || null,
    });
  }

  async function handleUploadSlip(paymentId: number, file: File) {
    setUploadingPaymentId(paymentId);
    try {
      const formData = new FormData();
      formData.append("slip", file);
      const res = await fetch(`/api/live/payments/${paymentId}/upload-slip`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "อัพโหลดสลิปไม่สำเร็จ");

      setVerifyResult(data);
      setVerifyResultDialogOpen(true);

      queryClient.invalidateQueries({ queryKey: ["/api/live/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/live/cf-orders"] });

      if (data.verification?.match) {
        toast({ title: "ตรวจสลิปสำเร็จ - ยอดตรงกัน", description: `สร้างออเดอร์ ${data.autoOrder?.orderNo || ""} + ใบกำกับภาษี ${data.autoTaxInvoice?.taxInvoiceNo || ""} อัตโนมัติ` });
      } else {
        toast({ title: "ตรวจสลิปแล้ว - ยอดไม่ตรง", description: data.verification?.note || "กรุณาตรวจสอบด้วยตนเอง", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    } finally {
      setUploadingPaymentId(null);
    }
  }

  async function handleVerifyPayment(paymentId: number) {
    try {
      const res = await fetch(`/api/live/payments/${paymentId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      queryClient.invalidateQueries({ queryKey: ["/api/live/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/live/cf-orders"] });

      let desc = "ยืนยันการชำระเงินสำเร็จ";
      if (data.autoOrder) desc += ` | ออเดอร์: ${data.autoOrder.orderNo}`;
      if (data.autoTaxInvoice) desc += ` | TIV: ${data.autoTaxInvoice.taxInvoiceNo}`;
      toast({ title: "อนุมัติสำเร็จ", description: desc });
    } catch (err: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    }
  }

  async function handleRejectPayment() {
    if (!rejectPaymentId) return;
    try {
      const res = await fetch(`/api/live/payments/${rejectPaymentId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", rejectReason }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      queryClient.invalidateQueries({ queryKey: ["/api/live/payments"] });
      toast({ title: "ปฏิเสธการชำระเงินแล้ว" });
    } catch (err: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    }
    setRejectDialogOpen(false);
    setRejectPaymentId(null);
    setRejectReason("");
  }

  function handleSubmitSessionProduct() {
    if (!sessionProductForm.productId || !sessionProductForm.cfCode || !sessionProductForm.livePrice || !sessionProductForm.availableQty) {
      toast({ title: "กรุณากรอกข้อมูลให้ครบ", variant: "destructive" });
      return;
    }
    createSessionProduct.mutate({
      productId: Number(sessionProductForm.productId),
      cfCode: sessionProductForm.cfCode,
      livePrice: sessionProductForm.livePrice,
      availableQty: Number(sessionProductForm.availableQty),
    });
  }

  function addCfOrderItem() {
    setCfOrderForm(prev => ({ ...prev, items: [...prev.items, { productId: "", quantity: "1", price: "" }] }));
  }

  function removeCfOrderItem(index: number) {
    setCfOrderForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  }

  function updateCfOrderItem(index: number, field: string, value: any) {
    setCfOrderForm(prev => ({ ...prev, items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item) }));
  }

  const sessionSummary = useMemo(() => {
    const total = sessions.length;
    const activeNow = sessions.filter((s: any) => s.status === "live").length;
    const totalRevenue = sessions.reduce((sum: number, s: any) => sum + Number(s.revenue || 0), 0);
    const totalOrders = sessions.reduce((sum: number, s: any) => sum + Number(s.ordersCount || 0), 0);
    return { total, activeNow, totalRevenue, totalOrders };
  }, [sessions]);

  const selectedCfOrder = cfOrders.find((o: any) => o.id === selectedCfOrderId);
  const sessionName = (id: number) => sessions.find((s: any) => s.id === id)?.title || "-";
  const productName = (id: number) => products.find(p => p.id === id)?.name || "-";
  const activeProducts = products.filter(p => p.active);

  return (
    <EcommerceLayout>
      <div className="space-y-6" data-testid="page-live-selling-hub">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Live Selling Hub</h1>
            <p className="text-muted-foreground text-sm">จัดการเซสชันไลฟ์ ออเดอร์ CF และตรวจสอบการชำระเงิน</p>
          </div>
          <Link href="/ecommerce/live-selling/dashboard">
            <Button className="bg-[#03c9d7] hover:bg-[#02b4c1] text-white gap-1.5" data-testid="button-dashboard">
              <BarChart3 className="h-4 w-4" />Dashboard ไลฟ์สด
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="sessions" data-testid="tabs-live-selling">
          <TabsList data-testid="tabs-list" className="flex-wrap">
            <TabsTrigger value="sessions" data-testid="tab-sessions"><Radio className="h-4 w-4 mr-1.5" />เซสชันไลฟ์</TabsTrigger>
            <TabsTrigger value="cf-orders" data-testid="tab-cf-orders"><ShoppingCart className="h-4 w-4 mr-1.5" />ออเดอร์ CF</TabsTrigger>
            <TabsTrigger value="payments" data-testid="tab-payments"><CreditCard className="h-4 w-4 mr-1.5" />ตรวจสลิป</TabsTrigger>
            <TabsTrigger value="session-products" data-testid="tab-session-products"><Package className="h-4 w-4 mr-1.5" />สินค้าไลฟ์</TabsTrigger>
          </TabsList>

          {/* Tab 1: Live Sessions */}
          <TabsContent value="sessions" data-testid="content-sessions">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card data-testid="card-total-sessions">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">เซสชันทั้งหมด</p>
                  <p className="text-2xl font-bold" style={{ color: "#03c9d7" }}>{sessionSummary.total}</p>
                </CardContent>
              </Card>
              <Card data-testid="card-active-now">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">กำลังไลฟ์อยู่</p>
                  <p className="text-2xl font-bold text-red-500">{sessionSummary.activeNow}</p>
                </CardContent>
              </Card>
              <Card data-testid="card-total-revenue">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">รายได้รวม</p>
                  <p className="text-2xl font-bold" style={{ color: "#fb9678" }}>฿{formatCurrency(sessionSummary.totalRevenue)}</p>
                </CardContent>
              </Card>
              <Card data-testid="card-total-orders">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">ออเดอร์รวม</p>
                  <p className="text-2xl font-bold" style={{ color: "#03c9d7" }}>{sessionSummary.totalOrders}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <h2 className="text-lg font-semibold">รายการเซสชันไลฟ์</h2>
                <Button data-testid="button-create-session" size="sm" onClick={() => { setEditingSessionId(null); setSessionForm({ ...emptySessionForm }); setSessionDialogOpen(true); }} style={{ background: "#03c9d7" }} className="text-white hover:opacity-90">
                  <Plus className="h-4 w-4 mr-1" />สร้างเซสชัน
                </Button>
              </CardHeader>
              <CardContent>
                {sessionsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
                ) : sessions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="text-no-sessions">ยังไม่มีเซสชันไลฟ์</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table data-testid="table-sessions">
                      <TableHeader>
                        <TableRow>
                          <TableHead>ชื่อเซสชัน</TableHead>
                          <TableHead>แพลตฟอร์ม</TableHead>
                          <TableHead>ผู้ดำเนินรายการ</TableHead>
                          <TableHead>สถานะ</TableHead>
                          <TableHead>เริ่มต้น</TableHead>
                          <TableHead>สิ้นสุด</TableHead>
                          <TableHead className="text-right">ออเดอร์</TableHead>
                          <TableHead className="text-right">รายได้</TableHead>
                          <TableHead>จัดการ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sessions.map((s: any) => (
                          <TableRow key={s.id} data-testid={`row-session-${s.id}`}>
                            <TableCell className="font-medium" data-testid={`text-session-title-${s.id}`}>{s.title}</TableCell>
                            <TableCell>{platformBadge(s.platform)}</TableCell>
                            <TableCell data-testid={`text-session-host-${s.id}`}>{s.host || "-"}</TableCell>
                            <TableCell>{sessionStatusBadge(s.status)}</TableCell>
                            <TableCell>{formatDateTime(s.startTime, dateEra, dateFmt)}</TableCell>
                            <TableCell>{formatDateTime(s.endTime, dateEra, dateFmt)}</TableCell>
                            <TableCell className="text-right" data-testid={`text-session-orders-${s.id}`}>{s.ordersCount || 0}</TableCell>
                            <TableCell className="text-right" data-testid={`text-session-revenue-${s.id}`}>฿{formatCurrency(s.revenue)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {s.status === "draft" && (
                                  <Button data-testid={`button-start-live-${s.id}`} size="sm" variant="ghost" className="text-green-600 hover:text-green-700" onClick={() => handleStartLive(s.id)} title="เริ่มไลฟ์">
                                    <Play className="h-4 w-4" />
                                  </Button>
                                )}
                                {s.status === "live" && (
                                  <Button data-testid={`button-end-live-${s.id}`} size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => handleEndLive(s.id)} title="จบไลฟ์">
                                    <Square className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button data-testid={`button-edit-session-${s.id}`} size="sm" variant="ghost" onClick={() => handleEditSession(s)} title="แก้ไข">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: CF Orders */}
          <TabsContent value="cf-orders" data-testid="content-cf-orders">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <h2 className="text-lg font-semibold">ออเดอร์ CF</h2>
                <Button data-testid="button-create-cf-order" size="sm" onClick={() => { setCfOrderForm({ ...emptyCFOrderForm }); setCfOrderDialogOpen(true); }} style={{ background: "#fb9678" }} className="text-white hover:opacity-90">
                  <Plus className="h-4 w-4 mr-1" />เพิ่มออเดอร์ CF
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3 mb-4">
                  <div className="w-48">
                    <Select value={cfSessionFilter} onValueChange={setCfSessionFilter} data-testid="select-cf-session-filter">
                      <SelectTrigger data-testid="trigger-cf-session-filter">
                        <SelectValue placeholder="เซสชันทั้งหมด" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">เซสชันทั้งหมด</SelectItem>
                        {sessions.map((s: any) => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-48">
                    <Select value={cfStatusFilter} onValueChange={setCfStatusFilter} data-testid="select-cf-status-filter">
                      <SelectTrigger data-testid="trigger-cf-status-filter">
                        <SelectValue placeholder="สถานะทั้งหมด" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">สถานะทั้งหมด</SelectItem>
                        {CF_ORDER_STATUSES.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {cfOrdersLoading ? (
                  <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
                ) : cfOrders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="text-no-cf-orders">ยังไม่มีออเดอร์ CF</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table data-testid="table-cf-orders">
                      <TableHeader>
                        <TableRow>
                          <TableHead>เลขออเดอร์</TableHead>
                          <TableHead>ชื่อลูกค้า</TableHead>
                          <TableHead>โซเชียล</TableHead>
                          <TableHead className="text-right">รายการ</TableHead>
                          <TableHead className="text-right">ยอดรวม</TableHead>
                          <TableHead className="text-right">ค่าส่ง</TableHead>
                          <TableHead>สถานะ</TableHead>
                          <TableHead>วันที่สร้าง</TableHead>
                          <TableHead>จัดการ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cfOrders.map((o: any) => (
                          <TableRow key={o.id} data-testid={`row-cf-order-${o.id}`}>
                            <TableCell className="font-medium" data-testid={`text-cf-order-number-${o.id}`}>#{o.orderNumber || o.id}</TableCell>
                            <TableCell data-testid={`text-cf-customer-${o.id}`}>{o.customerName}</TableCell>
                            <TableCell data-testid={`text-cf-social-${o.id}`}>{o.socialHandle || "-"}</TableCell>
                            <TableCell className="text-right" data-testid={`text-cf-items-${o.id}`}>{o.itemsCount || 0}</TableCell>
                            <TableCell className="text-right" data-testid={`text-cf-total-${o.id}`}>฿{formatCurrency(o.totalAmount)}</TableCell>
                            <TableCell className="text-right">฿{formatCurrency(o.shippingCost)}</TableCell>
                            <TableCell>{cfOrderStatusBadge(o.status)}</TableCell>
                            <TableCell>{formatDateTime(o.createdAt, dateEra, dateFmt)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button data-testid={`button-view-cf-order-${o.id}`} size="sm" variant="ghost" onClick={() => handleViewCfOrder(o.id)} title="ดูรายละเอียด">
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {o.status === "cf" && (
                                  <Button data-testid={`button-cf-to-awaiting-${o.id}`} size="sm" variant="ghost" className="text-yellow-600" onClick={() => updateCfOrder.mutate({ id: o.id, data: { status: "awaiting_payment" } })} title="ส่งรอชำระ">
                                    <CreditCard className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Payment Verification */}
          <TabsContent value="payments" data-testid="content-payments">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <h2 className="text-lg font-semibold">ตรวจสอบการชำระเงิน / สลิป</h2>
                <Button data-testid="button-add-payment" size="sm" onClick={() => { setPaymentForm({ ...emptyPaymentForm }); setPaymentDialogOpen(true); }} style={{ background: "#03c9d7" }} className="text-white hover:opacity-90">
                  <Plus className="h-4 w-4 mr-1" />เพิ่มการชำระเงิน
                </Button>
              </CardHeader>
              <CardContent>
                {paymentsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
                ) : payments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="text-no-payments">ยังไม่มีข้อมูลการชำระเงิน</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table data-testid="table-payments">
                      <TableHeader>
                        <TableRow>
                          <TableHead>อ้างอิงออเดอร์</TableHead>
                          <TableHead>ชื่อลูกค้า</TableHead>
                          <TableHead className="text-right">จำนวนเงิน</TableHead>
                          <TableHead>วิธีชำระ</TableHead>
                          <TableHead>ธนาคาร</TableHead>
                          <TableHead>สลิป / อัพโหลด</TableHead>
                          <TableHead>AI ตรวจสอบ</TableHead>
                          <TableHead>สถานะ</TableHead>
                          <TableHead>จัดการ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((p: any) => (
                          <TableRow key={p.id} data-testid={`row-payment-${p.id}`}>
                            <TableCell className="font-medium" data-testid={`text-payment-order-ref-${p.id}`}>#{p.cfOrderId}</TableCell>
                            <TableCell data-testid={`text-payment-customer-${p.id}`}>{p.customerName || "-"}</TableCell>
                            <TableCell className="text-right" data-testid={`text-payment-amount-${p.id}`}>฿{formatCurrency(p.amount)}</TableCell>
                            <TableCell>{PAYMENT_METHODS.find(m => m.value === p.method)?.label || p.method}</TableCell>
                            <TableCell>{p.bankName || p.aiVerifyBank || "-"}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {p.slipUrl ? (
                                  <Button data-testid={`button-view-slip-${p.id}`} size="sm" variant="ghost" onClick={() => { setSlipImageUrl(p.slipUrl); setSlipDialogOpen(true); }} title="ดูสลิป">
                                    <ImageIcon className="h-4 w-4 text-green-600" />
                                  </Button>
                                ) : null}
                                {(p.verificationStatus === "pending" || p.verificationStatus === "needs_review") && (
                                  <label className="cursor-pointer">
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      data-testid={`input-upload-slip-${p.id}`}
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleUploadSlip(p.id, file);
                                        e.target.value = "";
                                      }}
                                    />
                                    {uploadingPaymentId === p.id ? (
                                      <span className="inline-flex items-center gap-1 text-xs text-cyan-600"><Loader2 className="h-4 w-4 animate-spin" />AI กำลังตรวจ...</span>
                                    ) : (
                                      <Button size="sm" variant="outline" className="border-cyan-500 text-cyan-600 hover:bg-cyan-50 gap-1" asChild>
                                        <span><Upload className="h-3.5 w-3.5" />อัพโหลดสลิป</span>
                                      </Button>
                                    )}
                                  </label>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {p.aiVerifyNote ? (
                                <div className="text-xs max-w-48">
                                  {p.verificationStatus === "verified" ? (
                                    <span className="text-green-600 flex items-center gap-1"><FileCheck className="h-3.5 w-3.5 shrink-0" />{p.aiVerifyNote}</span>
                                  ) : p.verificationStatus === "needs_review" ? (
                                    <span className="text-amber-600 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{p.aiVerifyNote}</span>
                                  ) : (
                                    <span className="text-muted-foreground">{p.aiVerifyNote}</span>
                                  )}
                                </div>
                              ) : "-"}
                            </TableCell>
                            <TableCell>{paymentStatusBadge(p.verificationStatus || p.status)}</TableCell>
                            <TableCell>
                              {(p.verificationStatus === "pending" || p.verificationStatus === "needs_review") && (
                                <div className="flex items-center gap-1">
                                  <Button data-testid={`button-verify-payment-${p.id}`} size="sm" variant="ghost" className="text-green-600 hover:text-green-700" onClick={() => handleVerifyPayment(p.id)} title="อนุมัติ (สร้างออเดอร์+ใบกำกับภาษีอัตโนมัติ)">
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                  <Button data-testid={`button-reject-payment-${p.id}`} size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => { setRejectPaymentId(p.id); setRejectReason(""); setRejectDialogOpen(true); }} title="ปฏิเสธ">
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                              {p.verificationStatus === "verified" && (
                                <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" />ผ่านแล้ว</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 4: Session Products */}
          <TabsContent value="session-products" data-testid="content-session-products">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <h2 className="text-lg font-semibold">สินค้าในเซสชันไลฟ์</h2>
                {selectedProductSessionId && (
                  <Button data-testid="button-add-session-product" size="sm" onClick={() => { setSessionProductForm({ ...emptySessionProductForm }); setSessionProductDialogOpen(true); }} style={{ background: "#fb9678" }} className="text-white hover:opacity-90">
                    <Plus className="h-4 w-4 mr-1" />เพิ่มสินค้า
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="mb-4 w-64">
                  <Select value={String(selectedProductSessionId)} onValueChange={(v) => setSelectedProductSessionId(v ? Number(v) : "")} data-testid="select-product-session">
                    <SelectTrigger data-testid="trigger-product-session">
                      <SelectValue placeholder="เลือกเซสชัน" />
                    </SelectTrigger>
                    <SelectContent>
                      {sessions.map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!selectedProductSessionId ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="text-select-session-prompt">กรุณาเลือกเซสชันเพื่อดูสินค้า</div>
                ) : sessionProducts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="text-no-session-products">ยังไม่มีสินค้าในเซสชันนี้</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table data-testid="table-session-products">
                      <TableHeader>
                        <TableRow>
                          <TableHead>รหัส CF</TableHead>
                          <TableHead>สินค้า</TableHead>
                          <TableHead className="text-right">ราคาไลฟ์</TableHead>
                          <TableHead className="text-right">จำนวนทั้งหมด</TableHead>
                          <TableHead className="text-right">ขายแล้ว</TableHead>
                          <TableHead className="text-right">คงเหลือ</TableHead>
                          <TableHead className="w-40">ความคืบหน้า</TableHead>
                          <TableHead>จัดการ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sessionProducts.map((sp: any) => {
                          const remaining = Number(sp.availableQty || 0) - Number(sp.soldQty || 0);
                          const progressPercent = Number(sp.availableQty) > 0 ? (Number(sp.soldQty || 0) / Number(sp.availableQty)) * 100 : 0;
                          return (
                            <TableRow key={sp.id} data-testid={`row-session-product-${sp.id}`}>
                              <TableCell>
                                <Badge data-testid={`badge-cf-code-${sp.id}`} className="text-white" style={{ background: "#03c9d7" }}>{sp.cfCode}</Badge>
                              </TableCell>
                              <TableCell className="font-medium" data-testid={`text-sp-product-${sp.id}`}>{sp.productName || productName(sp.productId)}</TableCell>
                              <TableCell className="text-right" data-testid={`text-sp-price-${sp.id}`}>฿{formatCurrency(sp.livePrice)}</TableCell>
                              <TableCell className="text-right" data-testid={`text-sp-available-${sp.id}`}>{sp.availableQty}</TableCell>
                              <TableCell className="text-right" data-testid={`text-sp-sold-${sp.id}`}>{sp.soldQty || 0}</TableCell>
                              <TableCell className="text-right" data-testid={`text-sp-remaining-${sp.id}`}>{remaining}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Progress value={progressPercent} className="h-2 flex-1" data-testid={`progress-sp-${sp.id}`} />
                                  <span className="text-xs text-muted-foreground w-10 text-right">{Math.round(progressPercent)}%</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Button data-testid={`button-delete-sp-${sp.id}`} size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => deleteSessionProduct.mutate(sp.id)} title="ลบ">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog: Create/Edit Session */}
        <Dialog open={sessionDialogOpen} onOpenChange={setSessionDialogOpen}>
          <DialogContent data-testid="dialog-session">
            <DialogHeader>
              <DialogTitle>{editingSessionId ? "แก้ไขเซสชัน" : "สร้างเซสชันไลฟ์ใหม่"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>ชื่อเซสชัน</Label>
                <Input data-testid="input-session-title" value={sessionForm.title} onChange={e => setSessionForm(f => ({ ...f, title: e.target.value }))} placeholder="เช่น ไลฟ์ขายเสื้อผ้าคอลเลคชันใหม่" />
              </div>
              <div>
                <Label>แพลตฟอร์ม</Label>
                <Select value={sessionForm.platform} onValueChange={v => setSessionForm(f => ({ ...f, platform: v }))}>
                  <SelectTrigger data-testid="select-session-platform">
                    <SelectValue placeholder="เลือกแพลตฟอร์ม" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>หมายเหตุ</Label>
                <Textarea data-testid="input-session-notes" value={sessionForm.notes} onChange={e => setSessionForm(f => ({ ...f, notes: e.target.value }))} placeholder="หมายเหตุเพิ่มเติม (ไม่บังคับ)" rows={3} />
              </div>
              <div className="flex justify-end gap-2">
                <Button data-testid="button-cancel-session" variant="outline" onClick={resetSessionForm}>ยกเลิก</Button>
                <Button data-testid="button-submit-session" onClick={handleSubmitSession} style={{ background: "#03c9d7" }} className="text-white hover:opacity-90">
                  {editingSessionId ? "บันทึก" : "สร้างเซสชัน"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Add CF Order */}
        <Dialog open={cfOrderDialogOpen} onOpenChange={setCfOrderDialogOpen}>
          <DialogContent className="max-w-2xl" data-testid="dialog-cf-order">
            <DialogHeader>
              <DialogTitle>เพิ่มออเดอร์ CF</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>เซสชัน</Label>
                  <Select value={String(cfOrderForm.sessionId)} onValueChange={v => setCfOrderForm(f => ({ ...f, sessionId: v ? Number(v) : "" }))}>
                    <SelectTrigger data-testid="select-cf-order-session">
                      <SelectValue placeholder="เลือกเซสชัน" />
                    </SelectTrigger>
                    <SelectContent>
                      {sessions.map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>ชื่อลูกค้า</Label>
                  <Input data-testid="input-cf-customer-name" value={cfOrderForm.customerName} onChange={e => setCfOrderForm(f => ({ ...f, customerName: e.target.value }))} placeholder="ชื่อลูกค้า" />
                </div>
                <div>
                  <Label>เบอร์โทร</Label>
                  <Input data-testid="input-cf-phone" value={cfOrderForm.phone} onChange={e => setCfOrderForm(f => ({ ...f, phone: e.target.value }))} placeholder="เบอร์โทรศัพท์" />
                </div>
                <div>
                  <Label>โซเชียล Handle</Label>
                  <Input data-testid="input-cf-social" value={cfOrderForm.socialHandle} onChange={e => setCfOrderForm(f => ({ ...f, socialHandle: e.target.value }))} placeholder="@username" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-semibold">รายการสินค้า</Label>
                  <Button data-testid="button-add-cf-item" size="sm" variant="outline" onClick={addCfOrderItem}>
                    <Plus className="h-3 w-3 mr-1" />เพิ่มรายการ
                  </Button>
                </div>
                {cfOrderForm.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-end">
                    <div className="col-span-5">
                      {idx === 0 && <Label className="text-xs">สินค้า</Label>}
                      <Select value={String(item.productId)} onValueChange={v => updateCfOrderItem(idx, "productId", v ? Number(v) : "")}>
                        <SelectTrigger data-testid={`select-cf-item-product-${idx}`}>
                          <SelectValue placeholder="เลือกสินค้า" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeProducts.map(p => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      {idx === 0 && <Label className="text-xs">จำนวน</Label>}
                      <Input data-testid={`input-cf-item-qty-${idx}`} type="number" min="1" value={item.quantity} onChange={e => updateCfOrderItem(idx, "quantity", e.target.value)} />
                    </div>
                    <div className="col-span-3">
                      {idx === 0 && <Label className="text-xs">ราคา/ชิ้น</Label>}
                      <Input data-testid={`input-cf-item-price-${idx}`} type="number" min="0" value={item.price} onChange={e => updateCfOrderItem(idx, "price", e.target.value)} />
                    </div>
                    <div className="col-span-2 flex justify-end">
                      {cfOrderForm.items.length > 1 && (
                        <Button data-testid={`button-remove-cf-item-${idx}`} size="sm" variant="ghost" className="text-red-500" onClick={() => removeCfOrderItem(idx)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="text-right text-sm font-semibold mt-2" data-testid="text-cf-order-total">
                  รวม: ฿{formatCurrency(cfOrderForm.items.reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.price || 0), 0))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button data-testid="button-cancel-cf-order" variant="outline" onClick={resetCfOrderForm}>ยกเลิก</Button>
                <Button data-testid="button-submit-cf-order" onClick={handleSubmitCfOrder} style={{ background: "#fb9678" }} className="text-white hover:opacity-90">
                  เพิ่มออเดอร์
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: CF Order Detail */}
        <Dialog open={cfOrderDetailOpen} onOpenChange={setCfOrderDetailOpen}>
          <DialogContent data-testid="dialog-cf-order-detail">
            <DialogHeader>
              <DialogTitle>รายละเอียดออเดอร์ #{selectedCfOrder?.orderNumber || selectedCfOrder?.id}</DialogTitle>
            </DialogHeader>
            {selectedCfOrder && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">ลูกค้า:</span> {selectedCfOrder.customerName}</div>
                  <div><span className="text-muted-foreground">โซเชียล:</span> {selectedCfOrder.socialHandle || "-"}</div>
                  <div><span className="text-muted-foreground">เบอร์โทร:</span> {selectedCfOrder.phone || "-"}</div>
                  <div><span className="text-muted-foreground">สถานะ:</span> {cfOrderStatusBadge(selectedCfOrder.status)}</div>
                  <div><span className="text-muted-foreground">ยอดรวม:</span> ฿{formatCurrency(selectedCfOrder.totalAmount)}</div>
                  <div><span className="text-muted-foreground">ค่าส่ง:</span> ฿{formatCurrency(selectedCfOrder.shippingCost)}</div>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-2">รายการสินค้า</h4>
                  {cfOrderItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">ไม่มีรายการสินค้า</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>สินค้า</TableHead>
                          <TableHead className="text-right">จำนวน</TableHead>
                          <TableHead className="text-right">ราคา</TableHead>
                          <TableHead className="text-right">รวม</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cfOrderItems.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.productName || productName(item.productId)}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">฿{formatCurrency(item.price)}</TableCell>
                            <TableCell className="text-right">฿{formatCurrency(Number(item.quantity) * Number(item.price))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog: Add Payment */}
        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent data-testid="dialog-payment">
            <DialogHeader>
              <DialogTitle>เพิ่มการชำระเงิน</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>ออเดอร์ CF</Label>
                <Select value={String(paymentForm.cfOrderId)} onValueChange={v => setPaymentForm(f => ({ ...f, cfOrderId: v ? Number(v) : "" }))}>
                  <SelectTrigger data-testid="select-payment-cf-order">
                    <SelectValue placeholder="เลือกออเดอร์" />
                  </SelectTrigger>
                  <SelectContent>
                    {cfOrders.filter((o: any) => o.status === "awaiting_payment" || o.status === "cf").map((o: any) => (
                      <SelectItem key={o.id} value={String(o.id)}>#{o.orderNumber || o.id} - {o.customerName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>จำนวนเงิน</Label>
                  <Input data-testid="input-payment-amount" type="number" min="0" step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
                </div>
                <div>
                  <Label>วิธีชำระ</Label>
                  <Select value={paymentForm.method} onValueChange={v => setPaymentForm(f => ({ ...f, method: v }))}>
                    <SelectTrigger data-testid="select-payment-method">
                      <SelectValue placeholder="เลือกวิธีชำระ" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>ธนาคาร</Label>
                  <Input data-testid="input-payment-bank" value={paymentForm.bankName} onChange={e => setPaymentForm(f => ({ ...f, bankName: e.target.value }))} placeholder="ชื่อธนาคาร" />
                </div>
                <div>
                  <Label>วันที่โอน</Label>
                  <Input data-testid="input-payment-date" type="datetime-local" value={paymentForm.transferDate} onChange={e => setPaymentForm(f => ({ ...f, transferDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>URL สลิป</Label>
                <Input data-testid="input-payment-slip-url" value={paymentForm.slipUrl} onChange={e => setPaymentForm(f => ({ ...f, slipUrl: e.target.value }))} placeholder="https://..." />
              </div>
              <div className="flex justify-end gap-2">
                <Button data-testid="button-cancel-payment" variant="outline" onClick={resetPaymentForm}>ยกเลิก</Button>
                <Button data-testid="button-submit-payment" onClick={handleSubmitPayment} style={{ background: "#03c9d7" }} className="text-white hover:opacity-90">
                  บันทึกการชำระเงิน
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: View Slip Image */}
        <Dialog open={slipDialogOpen} onOpenChange={setSlipDialogOpen}>
          <DialogContent data-testid="dialog-slip-image">
            <DialogHeader>
              <DialogTitle>สลิปการโอนเงิน</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center">
              {slipImageUrl ? (
                <img src={slipImageUrl} alt="สลิปการโอนเงิน" className="max-w-full max-h-96 rounded-md border" data-testid="img-slip" />
              ) : (
                <p className="text-muted-foreground">ไม่พบรูปสลิป</p>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Reject Payment */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent data-testid="dialog-reject-payment">
            <DialogHeader>
              <DialogTitle>ปฏิเสธการชำระเงิน</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>เหตุผลในการปฏิเสธ</Label>
                <Textarea data-testid="input-reject-reason" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="ระบุเหตุผล เช่น ยอดไม่ตรง, สลิปไม่ชัด" rows={3} />
              </div>
              <div className="flex justify-end gap-2">
                <Button data-testid="button-cancel-reject" variant="outline" onClick={() => { setRejectDialogOpen(false); setRejectPaymentId(null); }}>ยกเลิก</Button>
                <Button data-testid="button-confirm-reject" variant="destructive" onClick={handleRejectPayment}>ยืนยันปฏิเสธ</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: AI Verification Result */}
        <Dialog open={verifyResultDialogOpen} onOpenChange={setVerifyResultDialogOpen}>
          <DialogContent className="max-w-md" data-testid="dialog-verify-result">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {verifyResult?.verification?.match ? (
                  <><CheckCircle className="h-5 w-5 text-green-600" />ตรวจสลิปสำเร็จ</>
                ) : (
                  <><AlertTriangle className="h-5 w-5 text-amber-600" />ตรวจสลิป - ต้องตรวจสอบเพิ่ม</>
                )}
              </DialogTitle>
            </DialogHeader>
            {verifyResult && (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">ยอดจากสลิป:</span>
                    <span className="font-medium">฿{formatCurrency(verifyResult.verification?.amount)}</span>
                    <span className="text-muted-foreground">ธนาคาร:</span>
                    <span className="font-medium">{verifyResult.verification?.bank || "-"}</span>
                    <span className="text-muted-foreground">เลขอ้างอิง:</span>
                    <span className="font-medium font-mono text-xs">{verifyResult.verification?.ref || "-"}</span>
                    <span className="text-muted-foreground">วันที่โอน:</span>
                    <span className="font-medium">{verifyResult.verification?.date || "-"}</span>
                  </div>
                </div>
                <p className="text-sm">{verifyResult.verification?.note}</p>
                {verifyResult.verification?.match && (
                  <div className="bg-green-50 border border-green-200 p-3 rounded-lg space-y-1.5">
                    <p className="text-sm font-medium text-green-800 flex items-center gap-1.5"><FileCheck className="h-4 w-4" />ระบบทำอัตโนมัติเสร็จแล้ว:</p>
                    {verifyResult.autoOrder && (
                      <p className="text-sm text-green-700 flex items-center gap-1.5"><ShoppingCart className="h-3.5 w-3.5" />สร้างออเดอร์: {verifyResult.autoOrder.orderNo}</p>
                    )}
                    {verifyResult.autoTaxInvoice && (
                      <p className="text-sm text-green-700 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />ใบกำกับภาษี: {verifyResult.autoTaxInvoice.taxInvoiceNo}</p>
                    )}
                  </div>
                )}
                {!verifyResult.verification?.match && (
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                    <p className="text-sm text-amber-800">ยอดไม่ตรงกัน กรุณาตรวจสอบด้วยตนเองแล้วกดอนุมัติหรือปฏิเสธ</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog: Add Session Product */}
        <Dialog open={sessionProductDialogOpen} onOpenChange={setSessionProductDialogOpen}>
          <DialogContent data-testid="dialog-session-product">
            <DialogHeader>
              <DialogTitle>เพิ่มสินค้าในเซสชัน</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>สินค้า</Label>
                <Select value={String(sessionProductForm.productId)} onValueChange={v => setSessionProductForm(f => ({ ...f, productId: v ? Number(v) : "" }))}>
                  <SelectTrigger data-testid="select-sp-product">
                    <SelectValue placeholder="เลือกสินค้า" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeProducts.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>รหัส CF</Label>
                  <Input data-testid="input-sp-cf-code" value={sessionProductForm.cfCode} onChange={e => setSessionProductForm(f => ({ ...f, cfCode: e.target.value }))} placeholder="CF1, CF2..." />
                </div>
                <div>
                  <Label>ราคาไลฟ์</Label>
                  <Input data-testid="input-sp-live-price" type="number" min="0" step="0.01" value={sessionProductForm.livePrice} onChange={e => setSessionProductForm(f => ({ ...f, livePrice: e.target.value }))} placeholder="0.00" />
                </div>
                <div>
                  <Label>จำนวน</Label>
                  <Input data-testid="input-sp-available-qty" type="number" min="1" value={sessionProductForm.availableQty} onChange={e => setSessionProductForm(f => ({ ...f, availableQty: e.target.value }))} placeholder="0" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button data-testid="button-cancel-sp" variant="outline" onClick={resetSessionProductForm}>ยกเลิก</Button>
                <Button data-testid="button-submit-sp" onClick={handleSubmitSessionProduct} style={{ background: "#fb9678" }} className="text-white hover:opacity-90">
                  เพิ่มสินค้า
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </EcommerceLayout>
  );
}
