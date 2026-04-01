import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Crown, Users, FileText, Store, Package, Zap,
  CheckCircle2, XCircle, ArrowLeft, Building2, ShoppingCart,
  Cpu, MessageCircle, ShieldCheck, Loader2, QrCode, Upload, ImageIcon,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

interface Plan {
  id: number;
  code: string;
  name: string;
  nameEn: string;
  description: string;
  monthlyPrice: string;
  yearlyPrice: string;
  maxUsers: number;
  maxDocumentsPerMonth: number;
  maxCompanies: number;
  maxEcommerceConnections: number;
  maxProducts: number;
  hasAiFeatures: boolean;
  hasHrModule: boolean;
  hasPosModule: boolean;
  hasApiAccess: boolean;
  hasWhiteLabel: boolean;
}

const planColors: Record<string, string> = {
  free: "#9ca3af",
  starter: "#03c9d7",
  pro: "#fb9678",
  enterprise: "#05b187",
};

export default function UpgradePlan() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [confirmPlan, setConfirmPlan] = useState<Plan | null>(null);
  const queryClient = useQueryClient();

  const { data: plans, isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["/api/subscription-plans"],
    queryFn: async () => {
      const r = await fetch("/api/subscription-plans", { credentials: "include" });
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: subInfo } = useQuery<any>({
    queryKey: ["/api/my-subscription-info"],
    queryFn: async () => {
      const r = await fetch("/api/my-subscription-info", { credentials: "include" });
      return r.json();
    },
  });

  const currentPlanCode = subInfo?.plan?.code || "free";

  const [paymentData, setPaymentData] = useState<{ order: any; qrData: string; totalAmount: number } | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createPayment = useMutation({
    mutationFn: async (planId: number) => {
      const r = await fetch("/api/subscription/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planId, billingCycle, orderType: "new" }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.message || "เกิดข้อผิดพลาด");
      }
      return r.json();
    },
    onSuccess: (data) => {
      setPaymentData(data);
    },
    onError: (err: Error) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const handleSlipSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "ไฟล์ใหญ่เกินไป", description: "สูงสุด 2MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setSlipPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleUploadSlip = async () => {
    if (!paymentData?.order?.id || !slipPreview) return;
    setUploadingSlip(true);
    try {
      const r = await fetch(`/api/subscription/upload-slip/${paymentData.order.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ slipImageUrl: slipPreview }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.message || "อัพโหลดไม่สำเร็จ");
      }
      const result = await r.json();
      if (result.aiVerified) {
        toast({ title: "ชำระเงินสำเร็จ!", description: result.message || "แพ็คเกจเปิดใช้งานแล้ว" });
      } else {
        toast({ title: "ส่งสลิปสำเร็จ", description: result.message || "รอทีมงานตรวจสอบ" });
      }
      setPaymentData(null);
      setSlipPreview(null);
      setConfirmPlan(null);
      queryClient.invalidateQueries({ queryKey: ["/api/my-subscription-info"] });
      setLocation("/settings/my-subscription");
    } catch (err: any) {
      toast({ title: "อัพโหลดไม่สำเร็จ", description: err.message, variant: "destructive" });
    } finally {
      setUploadingSlip(false);
    }
  };

  if (plansLoading) return <Layout><div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-[#03c9d7] border-t-transparent rounded-full" /></div></Layout>;

  const planFeatureDetails: Record<string, string[]> = {
    free: [
      "ผู้ใช้ 2 คน / บริษัท 1 แห่ง",
      "เอกสาร 50 รายการ/เดือน",
      "สินค้า 100 รายการ",
      "ใบเสนอราคา / ใบแจ้งหนี้ / ใบกำกับภาษี",
      "ใบเสร็จรับเงิน / ใบสั่งซื้อ",
      "รายงาน ภ.พ.30 / ภาษีซื้อ-ขาย",
      "แผนภูมิบัญชี & สมุดรายวัน",
      "พิมพ์เอกสารภาษีไทย",
    ],
    starter: [
      "ผู้ใช้ 5 คน / บริษัท 3 แห่ง",
      "เอกสาร 500 รายการ/เดือน",
      "สินค้า 1,000 รายการ",
      "E-Commerce 2 ร้านค้า (Shopee, Lazada ฯลฯ)",
      "ทุกฟีเจอร์จากแพ็คฟรี +",
      "HR & เงินเดือน / สลิปเงินเดือน",
      "ESS พอร์ทัลพนักงาน",
      "ลา / OT / ใบรับรองเงินเดือน",
      "ภงด.1 / 50 ทวิ / ใบแนบภาษี",
      "CRM ลูกค้า & ประวัติซื้อ",
      "บาร์โค้ด & พิมพ์ฉลาก",
      "คลังสินค้า & แจ้งเตือนสต็อกต่ำ",
    ],
    pro: [
      "ผู้ใช้ 20 คน / บริษัท 10 แห่ง",
      "เอกสาร 5,000 รายการ/เดือน",
      "สินค้า 10,000 รายการ",
      "E-Commerce 10 ร้านค้า (7 แพลตฟอร์ม)",
      "ทุกฟีเจอร์จากแพ็ค Starter +",
      "AI ตรวจสอบสลิปโอนเงินอัตโนมัติ",
      "AI วิเคราะห์ & แนะนำ",
      "POS ขายหน้าร้าน (สแกนบาร์โค้ด)",
      "Live Selling & CF Orders",
      "Facebook Chat Orders",
      "Fulfillment Pick-Pack-Ship",
      "โคลนร้านค้า/สินค้าข้ามแพลตฟอร์ม",
      "กำไรต่อออเดอร์ & Analytics",
      "สัญญาจ้างออนไลน์ & ลายเซ็น",
      "Ad Cost Tracking & ROAS",
      "Work Board (Monday.com-style)",
    ],
    enterprise: [
      "ผู้ใช้ไม่จำกัด / บริษัทไม่จำกัด",
      "เอกสารไม่จำกัด",
      "สินค้าไม่จำกัด",
      "E-Commerce ไม่จำกัดร้านค้า",
      "ทุกฟีเจอร์จากแพ็ค Pro +",
      "Open API เชื่อมต่อระบบภายนอก",
      "Multi-Warehouse & โอนสต็อก",
      "Bank Reconciliation",
      "แจ้งเตือน LINE Tracking",
      "Tax Invoice Reconciliation",
      "Auto Order Sync ทุกแพลตฟอร์ม",
      "Unified Chat Inbox",
      "Notification Center ครบวงจร",
      "Activity Log & Audit Trail",
      "ทีมซัพพอร์ตเฉพาะ (Dedicated)",
    ],
  };

  const comparisonCategories = [
    {
      title: "ข้อจำกัดการใช้งาน",
      features: [
        { label: "จำนวนผู้ใช้", key: "maxUsers", format: (v: number) => v >= 999 ? "ไม่จำกัด" : `${v} คน` },
        { label: "จำนวนบริษัท", key: "maxCompanies", format: (v: number) => v >= 999 ? "ไม่จำกัด" : `${v} แห่ง` },
        { label: "เอกสาร/เดือน", key: "maxDocumentsPerMonth", format: (v: number) => v >= 999999 ? "ไม่จำกัด" : v.toLocaleString() },
        { label: "จำนวนสินค้า", key: "maxProducts", format: (v: number) => v >= 999999 ? "ไม่จำกัด" : v.toLocaleString() },
        { label: "ร้านค้า E-Commerce", key: "maxEcommerceConnections", format: (v: number) => v >= 999 ? "ไม่จำกัด" : v === 0 ? "-" : `${v} ร้าน` },
      ],
    },
    {
      title: "เอกสาร & บัญชี",
      features: [
        { label: "ใบเสนอราคา / ใบแจ้งหนี้", static: [true, true, true, true] },
        { label: "ใบกำกับภาษี / ใบเสร็จ", static: [true, true, true, true] },
        { label: "ใบสั่งซื้อ / ค่าใช้จ่าย", static: [true, true, true, true] },
        { label: "แผนภูมิบัญชี & สมุดรายวัน", static: [true, true, true, true] },
        { label: "รายงาน ภ.พ.30 / ภาษีซื้อ-ขาย", static: [true, true, true, true] },
        { label: "AR/AP Aging Report", static: [false, true, true, true] },
        { label: "Bank Reconciliation", static: [false, false, false, true] },
      ],
    },
    {
      title: "E-Commerce & ขายออนไลน์",
      features: [
        { label: "เชื่อมต่อ Shopee / Lazada / TikTok", static: [false, true, true, true] },
        { label: "Grab Food / LINE MAN / Robinhood", static: [false, false, true, true] },
        { label: "Amazon", static: [false, false, true, true] },
        { label: "Auto Order Sync", static: [false, false, false, true] },
        { label: "Fulfillment Pick-Pack-Ship", static: [false, false, true, true] },
        { label: "โคลนร้านค้า/สินค้าข้ามแพลตฟอร์ม", static: [false, false, true, true] },
        { label: "Live Selling & CF Orders", static: [false, false, true, true] },
        { label: "Facebook Chat Orders", static: [false, false, true, true] },
        { label: "Unified Chat Inbox", static: [false, false, false, true] },
        { label: "Shipping Labels", static: [false, false, true, true] },
        { label: "LINE Tracking แจ้งเลขพัสดุ", static: [false, false, false, true] },
      ],
    },
    {
      title: "AI อัจฉริยะ",
      features: [
        { label: "AI ตรวจสอบสลิปโอนเงิน", key: "hasAiFeatures" },
        { label: "AI วิเคราะห์ & แนะนำ", key: "hasAiFeatures" },
      ],
    },
    {
      title: "โมดูลเสริม",
      features: [
        { label: "HR & เงินเดือน", key: "hasHrModule" },
        { label: "ESS พอร์ทัลพนักงาน", key: "hasHrModule" },
        { label: "ภงด.1 / 50 ทวิ / ใบแนบภาษี", key: "hasHrModule" },
        { label: "POS ขายหน้าร้าน", key: "hasPosModule" },
        { label: "Open API เชื่อมต่อภายนอก", key: "hasApiAccess" },
        { label: "White Label แบรนด์ของคุณ", key: "hasWhiteLabel" },
      ],
    },
    {
      title: "CRM & การตลาด",
      features: [
        { label: "CRM ลูกค้า & ประวัติซื้อ", static: [false, true, true, true] },
        { label: "Ad Cost Tracking & ROAS", static: [false, false, true, true] },
        { label: "โปรโมชัน & ส่วนลด", static: [false, true, true, true] },
      ],
    },
    {
      title: "เครื่องมือเพิ่มเติม",
      features: [
        { label: "Work Board (Monday.com-style)", static: [false, false, true, true] },
        { label: "สัญญาจ้างออนไลน์ & ลายเซ็น", static: [false, false, true, true] },
        { label: "บาร์โค้ด & พิมพ์ฉลาก", static: [false, true, true, true] },
        { label: "Multi-Warehouse & โอนสต็อก", static: [false, false, false, true] },
        { label: "Notification Center", static: [false, false, false, true] },
        { label: "Activity Log & Audit Trail", static: [false, false, false, true] },
        { label: "Export Excel", static: [true, true, true, true] },
      ],
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/settings/my-subscription")} className="rounded-full" data-testid="btn-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">อัพเกรดแพ็คเกจ</h1>
        </div>

        <div className="flex justify-center">
          <div className="bg-gray-100 rounded-full p-1 flex">
            <button
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${billingCycle === "monthly" ? "bg-white shadow text-gray-800" : "text-gray-500"}`}
              onClick={() => setBillingCycle("monthly")}
              data-testid="btn-monthly"
            >
              รายเดือน
            </button>
            <button
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${billingCycle === "yearly" ? "bg-white shadow text-gray-800" : "text-gray-500"}`}
              onClick={() => setBillingCycle("yearly")}
              data-testid="btn-yearly"
            >
              รายปี <span className="text-xs text-green-600 font-bold">ประหยัด 17%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans?.map((plan) => {
            const isCurrent = plan.code === currentPlanCode;
            const color = planColors[plan.code] || "#9ca3af";
            const isPopular = plan.code === "pro";
            const price = billingCycle === "yearly" ? Number(plan.yearlyPrice) : Number(plan.monthlyPrice);
            const monthlyEquiv = billingCycle === "yearly" ? Math.round(price / 12) : price;

            return (
              <Card
                key={plan.id}
                className={`border-2 relative overflow-hidden transition-all hover:shadow-lg ${isCurrent ? "shadow-lg" : ""}`}
                style={{ borderColor: isCurrent ? color : isPopular ? color : "#e5e7eb" }}
                data-testid={`upgrade-card-${plan.code}`}
              >
                {isPopular && (
                  <div className="absolute top-0 right-0 px-3 py-1 text-xs font-bold text-white rounded-bl-xl" style={{ background: color }}>
                    แนะนำ
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute top-0 left-0 px-3 py-1 text-xs font-bold text-white rounded-br-xl" style={{ background: color }}>
                    ปัจจุบัน
                  </div>
                )}
                <CardContent className="pt-8 pb-6 space-y-4">
                  <div className="text-center">
                    <h3 className="text-lg font-bold" style={{ color }}>{plan.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">{plan.description}</p>
                    <div className="mt-3">
                      <span className="text-3xl font-extrabold text-gray-800">
                        {price === 0 ? "ฟรี" : `฿${monthlyEquiv.toLocaleString()}`}
                      </span>
                      {price > 0 && <span className="text-sm text-gray-400">/เดือน</span>}
                    </div>
                    {billingCycle === "yearly" && price > 0 && (
                      <p className="text-xs text-gray-400 mt-1">เรียกเก็บ ฿{price.toLocaleString()}/ปี</p>
                    )}
                  </div>

                  <div className="pt-2">
                    {isCurrent ? (
                      <Button disabled className="w-full rounded-xl h-10 text-sm" variant="outline" data-testid={`btn-current-${plan.code}`}>
                        ใช้งานอยู่
                      </Button>
                    ) : (
                      <Button
                        className="w-full rounded-xl h-10 text-sm font-semibold"
                        style={{ background: color, color: "#fff" }}
                        onClick={() => setConfirmPlan(plan)}
                        data-testid={`btn-upgrade-${plan.code}`}
                      >
                        {Number(plan.monthlyPrice) > Number(subInfo?.plan?.monthlyPrice || 0)
                          ? "อัพเกรดเลย"
                          : Number(plan.monthlyPrice) === 0
                          ? "ดาวน์เกรด"
                          : "เปลี่ยนแพ็คเกจ"}
                      </Button>
                    )}
                  </div>

                  <div className="border-t pt-3 space-y-1.5">
                    {(planFeatureDetails[plan.code] || []).map((feat, i) => {
                      const isHeader = feat.includes("ทุกฟีเจอร์จาก");
                      return (
                        <div key={i} className={`flex items-start gap-2 text-xs ${isHeader ? "pt-1" : ""}`}>
                          {isHeader ? (
                            <ArrowLeft className="h-3 w-3 mt-0.5 rotate-180 shrink-0" style={{ color }} />
                          ) : (
                            <CheckCircle2 className="h-3 w-3 mt-0.5 text-green-500 shrink-0" />
                          )}
                          <span className={isHeader ? "font-semibold" : "text-gray-600"} style={isHeader ? { color } : {}}>
                            {feat}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {plans && plans.length > 0 && (
          <Card className="border-0 shadow-md overflow-hidden" data-testid="card-comparison-table">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-gray-600">เปรียบเทียบรายละเอียดทุกแพ็คเกจ</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 w-[240px] min-w-[200px]">ฟีเจอร์</th>
                      {plans.map((p) => (
                        <th key={p.id} className="text-center px-3 py-3 font-bold min-w-[120px]" style={{ color: planColors[p.code] || "#9ca3af" }}>
                          {p.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonCategories.map((cat, ci) => (
                      <>
                        <tr key={`cat-${ci}`} className="bg-gray-50/50">
                          <td colSpan={plans.length + 1} className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                            {cat.title}
                          </td>
                        </tr>
                        {cat.features.map((feat, fi) => (
                          <tr key={`${ci}-${fi}`} className="border-b border-gray-50 hover:bg-gray-50/30">
                            <td className="px-4 py-2.5 text-xs text-gray-600">{feat.label}</td>
                            {plans.map((p, pi) => {
                              if ('static' in feat && feat.static) {
                                const enabled = feat.static[pi];
                                return (
                                  <td key={p.id} className="text-center px-3 py-2.5">
                                    {enabled ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                                    ) : (
                                      <XCircle className="h-4 w-4 text-gray-200 mx-auto" />
                                    )}
                                  </td>
                                );
                              }
                              if ('key' in feat && feat.key) {
                                const val = (p as any)[feat.key];
                                if (typeof val === "boolean") {
                                  return (
                                    <td key={p.id} className="text-center px-3 py-2.5">
                                      {val ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                                      ) : (
                                        <XCircle className="h-4 w-4 text-gray-200 mx-auto" />
                                      )}
                                    </td>
                                  );
                                }
                                return (
                                  <td key={p.id} className="text-center px-3 py-2.5 text-xs font-medium text-gray-700">
                                    {'format' in feat && feat.format ? (feat.format as any)(val) : val}
                                  </td>
                                );
                              }
                              return <td key={p.id} className="text-center px-3 py-2.5">-</td>;
                            })}
                          </tr>
                        ))}
                      </>
                    ))}
                    <tr className="bg-gray-50 border-t-2">
                      <td className="px-4 py-3 text-xs font-bold text-gray-600">ราคา/เดือน</td>
                      {plans.map((p) => {
                        const pr = billingCycle === "yearly" ? Math.round(Number(p.yearlyPrice) / 12) : Number(p.monthlyPrice);
                        return (
                          <td key={p.id} className="text-center px-3 py-3 font-bold text-sm" style={{ color: planColors[p.code] }}>
                            {pr === 0 ? "ฟรี" : `฿${pr.toLocaleString()}`}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-0 shadow-md" data-testid="card-contact">
          <CardContent className="py-6">
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center text-center sm:text-left">
              <div className="h-12 w-12 rounded-full bg-[#03c9d720] flex items-center justify-center">
                <MessageCircle className="h-6 w-6 text-[#03c9d7]" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">ต้องการความช่วยเหลือ?</h3>
                <p className="text-sm text-gray-500">ติดต่อทีมงานเพื่อสอบถามรายละเอียดแพ็คเกจ หรือขอใบเสนอราคาสำหรับองค์กร</p>
              </div>
              <Button variant="outline" className="rounded-xl shrink-0" style={{ borderColor: "#03c9d7", color: "#03c9d7" }} data-testid="btn-contact-sales">
                ติดต่อฝ่ายขาย
              </Button>
            </div>
          </CardContent>
        </Card>

        <Dialog open={!!confirmPlan} onOpenChange={(open) => { if (!open) { setConfirmPlan(null); setPaymentData(null); setSlipPreview(null); } }}>
          <DialogContent className="rounded-2xl max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg">
                {paymentData ? "ชำระเงิน" : "ยืนยันเปลี่ยนแพ็คเกจ"}
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-500">
                {paymentData ? "สแกน QR Code เพื่อชำระเงิน แล้วแนบสลิป" : "คุณต้องการเปลี่ยนแพ็คเกจใช่หรือไม่?"}
              </DialogDescription>
            </DialogHeader>

            {confirmPlan && !paymentData && (
              <div className="space-y-3 py-2">
                <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                  <div>
                    <p className="text-xs text-gray-500">จาก</p>
                    <p className="font-semibold text-gray-700">{subInfo?.plan?.name || "ฟรี"}</p>
                  </div>
                  <ArrowLeft className="h-5 w-5 text-gray-300 rotate-180" />
                  <div className="text-right">
                    <p className="text-xs text-gray-500">เปลี่ยนเป็น</p>
                    <p className="font-bold" style={{ color: planColors[confirmPlan.code] || "#9ca3af" }}>{confirmPlan.name}</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">รอบชำระ</span>
                    <span className="font-medium">{billingCycle === "yearly" ? "รายปี" : "รายเดือน"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">ราคา</span>
                    <span className="font-bold" style={{ color: planColors[confirmPlan.code] }}>
                      ฿{Number(billingCycle === "yearly" ? confirmPlan.yearlyPrice : confirmPlan.monthlyPrice).toLocaleString()}/{billingCycle === "yearly" ? "ปี" : "เดือน"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="rounded-xl flex-1" onClick={() => setConfirmPlan(null)} data-testid="btn-cancel-change">
                    ยกเลิก
                  </Button>
                  <Button
                    className="rounded-xl font-semibold flex-1"
                    style={{ background: planColors[confirmPlan.code] || "#03c9d7", color: "#fff" }}
                    onClick={() => createPayment.mutate(confirmPlan.id)}
                    disabled={createPayment.isPending}
                    data-testid="btn-confirm-change"
                  >
                    {createPayment.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <QrCode className="h-4 w-4 mr-2" />}
                    ชำระเงิน
                  </Button>
                </div>
              </div>
            )}

            {paymentData && (
              <div className="space-y-4 py-2">
                <div className="text-center space-y-2">
                  <div className="bg-white border-2 border-gray-200 rounded-xl p-4 inline-block mx-auto">
                    {paymentData.qrImageDataUrl ? (
                      <img src={paymentData.qrImageDataUrl} alt="PromptPay QR" className="w-48 h-48 mx-auto" />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center bg-gray-50 rounded-xl">
                        <div className="text-center">
                          <QrCode className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                          <p className="text-xs text-gray-500">สแกน QR จากแอพธนาคาร</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-2xl font-bold" style={{ color: confirmPlan ? planColors[confirmPlan.code] : "#03c9d7" }}>
                    ฿{paymentData.totalAmount.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">สแกน QR Code ด้วยแอพธนาคาร หรือ PromptPay</p>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <p className="text-sm font-semibold text-gray-700">แนบสลิปการโอนเงิน</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleSlipSelect}
                    data-testid="input-slip-file"
                  />
                  {slipPreview ? (
                    <div className="relative">
                      <img src={slipPreview} alt="สลิป" className="w-full max-h-48 object-contain rounded-xl border" />
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2 rounded-full h-8 w-8 p-0"
                        onClick={() => { setSlipPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full rounded-xl border-dashed border-2 h-24 flex-col gap-2"
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="btn-select-slip"
                    >
                      <ImageIcon className="h-6 w-6 text-gray-400" />
                      <span className="text-sm text-gray-500">เลือกรูปสลิป</span>
                    </Button>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" className="rounded-xl flex-1" onClick={() => { setPaymentData(null); setSlipPreview(null); }}>
                      ย้อนกลับ
                    </Button>
                    <Button
                      className="rounded-xl font-semibold flex-1"
                      style={{ background: "#05b187", color: "#fff" }}
                      onClick={handleUploadSlip}
                      disabled={!slipPreview || uploadingSlip}
                      data-testid="btn-upload-slip"
                    >
                      {uploadingSlip ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                      ส่งสลิป
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
