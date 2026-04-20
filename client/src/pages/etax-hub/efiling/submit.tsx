import { useState } from "react";
import { useLocation } from "wouter";
import EtaxCenterLayout from "@/components/etax-center-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, XCircle, Loader2, FileText,
  Shield, Send, Eye, Download, Clock, Receipt, KeyRound, CreditCard,
} from "lucide-react";

type Stage = "preview" | "preflight" | "signing" | "submitting" | "result" | "payin" | "complete";

const PP30_PREVIEW = {
  clientName: "บริษัท เอบีซี จำกัด",
  taxId: "0105561012345",
  branchNo: 0,
  period: "2026-03",
  filingType: "0",
  filingNo: 0,
  fields: [
    { no: 1, label: "ยอดขายรวมทั้งสิ้น", value: 1850000.00, calc: false },
    { no: 2, label: "(หัก) ยอดขายที่เสียภาษีในอัตราร้อยละ 0", value: 50000.00, calc: false },
    { no: 3, label: "(หัก) ยอดขายที่ได้รับยกเว้นภาษี", value: 0.00, calc: false },
    { no: 4, label: "ยอดขายที่ต้องเสียภาษี", value: 1800000.00, calc: true },
    { no: 5, label: "ภาษีขาย", value: 126000.00, calc: true },
    { no: 6, label: "ยอดซื้อที่มีสิทธิขอคืนภาษี", value: 1393571.43, calc: false },
    { no: 7, label: "ภาษีซื้อ", value: 97550.00, calc: true },
    { no: 8, label: "ภาษีที่ต้องชำระ (5-7)", value: 28450.00, calc: true, highlight: true },
    { no: 9, label: "ภาษีที่ชำระเกิน", value: 0.00, calc: true },
  ],
};

const PRE_FLIGHT_CHECKS = [
  { id: "consent", label: "ลูกค้าเซ็น PDPA Consent แล้ว", status: "pass" as const, detail: "เซ็นเมื่อ 15/02/2569 (มีผลถึง 15/02/2570)" },
  { id: "kyc", label: "ผ่าน KYC ตาม ETDA standard", status: "pass" as const, detail: "ตรวจสอบเลขผู้เสียภาษีกับกรมสรรพากร — ตรงกัน" },
  { id: "auth", label: "มี ภ.อ.01 มอบอำนาจที่ RD แล้ว", status: "pass" as const, detail: "ลูกค้ามอบอำนาจ E-Tax Center เมื่อ 20/02/2569" },
  { id: "data", label: "ข้อมูลครบถ้วน (16 ฟิลด์)", status: "pass" as const, detail: "ใบกำกับขาย 47 ใบ, ใบกำกับซื้อ 23 ใบ, รายจ่าย 12 รายการ" },
  { id: "due", label: "ยังไม่เลยกำหนดยื่น", status: "pass" as const, detail: "เหลือ 3 วัน (กำหนด 23/04/2569)" },
  { id: "cert", label: "CA Certificate ยังไม่หมดอายุ", status: "warning" as const, detail: "เหลืออายุ 287 วัน (หมดอายุ 02/02/2570)" },
];

const RESPONSE_CODES = {
  success: { code: "I01000", message: "สำเร็จ", color: "text-emerald-600" },
};

export default function EfilingSubmit() {
  const [, setLocation] = useLocation();
  const [stage, setStage] = useState<Stage>("preview");
  const [otpInput, setOtpInput] = useState("");
  const [progress, setProgress] = useState(0);

  const total = PP30_PREVIEW.fields.find(f => f.no === 8)?.value || 0;

  // Simulate stage progression
  const startSubmit = () => {
    setStage("signing");
    setProgress(0);
    const steps = [
      { stage: "signing" as Stage, duration: 1500, msg: "เข้ารหัส JWS + JWE" },
      { stage: "submitting" as Stage, duration: 2500, msg: "ส่งให้ RD" },
      { stage: "result" as Stage, duration: 0, msg: "" },
    ];
    let cumulative = 0;
    steps.forEach(s => {
      cumulative += s.duration;
      setTimeout(() => setStage(s.stage), cumulative);
    });
    let p = 0;
    const interval = setInterval(() => {
      p += 5;
      setProgress(Math.min(p, 100));
      if (p >= 100) clearInterval(interval);
    }, 200);
  };

  return (
    <EtaxCenterLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/etax-hub/efiling")} data-testid="btn-back">
              <ArrowLeft className="w-4 h-4 mr-1" />กลับ
            </Button>
            <h1 className="text-2xl font-bold text-gray-800 mt-2" data-testid="text-submit-title">
              ยื่นแบบ ภ.พ.30 — {PP30_PREVIEW.clientName}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              งวด {PP30_PREVIEW.period} • เลขผู้เสียภาษี {PP30_PREVIEW.taxId} • สำนักงานใหญ่
            </p>
          </div>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 px-3 py-1">
            โหมดทดสอบ (Mock data)
          </Badge>
        </div>

        {/* Stage Stepper */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {[
                { id: "preview", label: "1. Preview", icon: Eye },
                { id: "preflight", label: "2. Pre-flight", icon: Shield },
                { id: "signing", label: "3. ลงนาม", icon: KeyRound },
                { id: "submitting", label: "4. ส่ง", icon: Send },
                { id: "result", label: "5. ผลลัพธ์", icon: CheckCircle2 },
                { id: "payin", label: "6. ชำระเงิน", icon: CreditCard },
                { id: "complete", label: "7. ใบเสร็จ", icon: Receipt },
              ].map((s, i, arr) => {
                const stageOrder = ["preview", "preflight", "signing", "submitting", "result", "payin", "complete"];
                const currentIdx = stageOrder.indexOf(stage);
                const sIdx = stageOrder.indexOf(s.id);
                const isCurrent = stage === s.id;
                const isPast = sIdx < currentIdx;
                const Icon = s.icon;
                return (
                  <div key={s.id} className="flex items-center shrink-0">
                    <button
                      onClick={() => isPast && setStage(s.id as Stage)}
                      disabled={!isPast && !isCurrent}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition ${
                        isCurrent ? "bg-[#fb9678] text-white"
                        : isPast ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 cursor-pointer"
                        : "bg-gray-100 text-gray-400"
                      }`}
                      data-testid={`stage-${s.id}`}
                    >
                      <Icon className="w-4 h-4" />{s.label}
                    </button>
                    {i < arr.length - 1 && <ArrowRight className="w-4 h-4 mx-1 text-gray-300 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Stage Content */}
        {stage === "preview" && <PreviewStage onNext={() => setStage("preflight")} total={total} />}
        {stage === "preflight" && <PreflightStage onBack={() => setStage("preview")} onNext={() => startSubmit()} />}
        {(stage === "signing" || stage === "submitting") && (
          <ProcessingStage stage={stage} progress={progress} />
        )}
        {stage === "result" && <ResultStage onNext={() => setStage("payin")} total={total} />}
        {stage === "payin" && <PayinStage onNext={() => setStage("complete")} total={total} />}
        {stage === "complete" && <CompleteStage onViewReceipt={() => setLocation("/etax-hub/efiling/receipts")} />}
      </div>
    </EtaxCenterLayout>
  );
}

function PreviewStage({ onNext, total }: { onNext: () => void; total: number }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>ภ.พ.30 — รายการที่จะส่งให้กรมสรรพากร</span>
            <Badge variant="outline" className="font-normal">16 ฟิลด์</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <tbody>
              {PP30_PREVIEW.fields.map((f) => (
                <tr key={f.no} className={`border-b border-gray-100 ${f.highlight ? "bg-amber-50" : ""}`}>
                  <td className="px-4 py-2.5 text-gray-500 text-xs w-12">ข้อ {f.no}</td>
                  <td className="px-4 py-2.5">{f.label}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                    {f.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-2 py-2.5 w-16 text-xs text-gray-400">
                    {f.calc && <Badge variant="outline" className="text-xs font-normal">คำนวณ</Badge>}
                  </td>
                </tr>
              ))}
              <tr className="bg-emerald-50">
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 font-bold">ยอดที่ต้องชำระ</td>
                <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-700 text-lg">
                  ฿{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-sm">📦 JSON Payload (ที่จะส่งให้ RD)</CardTitle></CardHeader>
          <CardContent>
            <pre className="text-xs bg-gray-50 rounded p-3 overflow-x-auto max-h-72 font-mono">
{`{
  "eFiling": {
    "sender": { "id": "OA1-...", "role": 2 },
    "requestId": "30-260420-1001",
    "rdForm": {
      "exchangeDocument": {
        "formType": "PP30",
        "version": "0.0.1"
      },
      "formData": [{
        "taxPayer": {
          "specifiedTaxRegistration": {
            "id": "0105561012345"
          },
          "branchNo": 0
        },
        "taxForm": {
          "taxPeriod": {
            "taxMonth": 3,
            "taxYear": 2569
          },
          "filing": {
            "filingType": "0",
            "filingNo": null
          }
        },
        "taxFormDetail": {
          "totalSale": 1850000.00,
          "zeroRateSale": 50000.00,
          "exemptSale": 0.00,
          "taxableSale": 1800000.00,
          "salesTax": 126000.00,
          "purchase": 1393571.43,
          "purchaseTax": 97550.00,
          "netTax": 28450.00,
          "overpaidTax": 0.00
        }
      }]
    }
  }
}`}
            </pre>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" data-testid="btn-export-json">
            <Download className="w-4 h-4 mr-2" />ดาวน์โหลด JSON
          </Button>
          <Button className="flex-1 bg-[#fb9678] hover:bg-[#e8856a] text-white" onClick={onNext} data-testid="btn-to-preflight">
            ถัดไป<ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function PreflightStage({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const allPass = PRE_FLIGHT_CHECKS.every(c => c.status === "pass" || c.status === "warning");
  const [otp, setOtp] = useState("");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Pre-flight Check — ก่อนส่งให้ RD</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {PRE_FLIGHT_CHECKS.map((check) => {
            const Icon = check.status === "pass" ? CheckCircle2
              : check.status === "warning" ? AlertTriangle : XCircle;
            const color = check.status === "pass" ? "text-emerald-600 bg-emerald-50"
              : check.status === "warning" ? "text-amber-600 bg-amber-50"
              : "text-red-600 bg-red-50";
            return (
              <div key={check.id} className={`flex gap-3 p-3 rounded-lg ${color}`} data-testid={`check-${check.id}`}>
                <Icon className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-sm">{check.label}</p>
                  <p className="text-xs opacity-75 mt-0.5">{check.detail}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4" />ยืนยันตัวตน
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-gray-600 mb-1 block">OTP จากแอป Authenticator (พี่ทราย)</label>
            <Input
              placeholder="6 หลัก"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="text-center text-2xl tracking-widest font-mono"
              data-testid="input-otp"
            />
            <p className="text-xs text-gray-400 mt-1">ใช้ Google Authenticator หรือ Microsoft Authenticator</p>
          </div>

          <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800">
            <p className="font-medium mb-1">📝 บันทึกการลงนาม</p>
            <p>การกดปุ่มข้างล่างเป็นการอนุญาตให้ระบบลงลายมือชื่ออิเล็กทรอนิกส์ในนามของ E-Tax Center และส่งให้กรมสรรพากร — บันทึกลง audit log ตาม PDPA</p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onBack} className="flex-1" data-testid="btn-back-preview">กลับ</Button>
            <Button
              className="flex-1 bg-[#fb9678] hover:bg-[#e8856a] text-white"
              disabled={!allPass || otp.length !== 6}
              onClick={onNext}
              data-testid="btn-sign-submit"
            >
              <Send className="w-4 h-4 mr-1" />ลงนาม + ส่ง
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProcessingStage({ stage, progress }: { stage: Stage; progress: number }) {
  const steps = [
    { id: "auth", label: "ยืนยันตัวตน /oapi/submit-filing-auth", done: true },
    { id: "sign", label: "เข้ารหัส JWS (RS256 + x5c cert)", done: true },
    { id: "encrypt", label: "เข้ารหัส JWE (A256GCM + RD public key)", done: stage !== "signing" },
    { id: "send", label: "POST /oapi/submit-form", done: stage === "submitting" && progress > 50 },
    { id: "verify", label: "RD ตรวจสอบและตอบกลับ", done: false },
  ];

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-12 text-center">
        <Loader2 className="w-16 h-16 text-[#fb9678] animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2" data-testid="text-processing">
          {stage === "signing" ? "กำลังลงนามและเข้ารหัส..." : "กำลังส่งให้กรมสรรพากร..."}
        </h2>
        <p className="text-gray-500 text-sm mb-6">โปรดอย่าปิดหน้านี้</p>

        <div className="max-w-md mx-auto space-y-2 text-left">
          {steps.map((s) => (
            <div key={s.id} className="flex items-center gap-3 text-sm" data-testid={`step-${s.id}`}>
              {s.done ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Loader2 className="w-4 h-4 text-gray-300 shrink-0 animate-spin" />
              )}
              <span className={s.done ? "text-gray-700" : "text-gray-400"}>{s.label}</span>
            </div>
          ))}
        </div>

        <div className="max-w-md mx-auto mt-6 bg-gray-100 rounded-full h-2 overflow-hidden">
          <div className="bg-[#fb9678] h-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </CardContent>
    </Card>
  );
}

function ResultStage({ onNext, total }: { onNext: () => void; total: number }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="w-5 h-5" />ส่งสำเร็จ — RD รับเรียบร้อย
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Response Code" value={<Badge className="bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">{RESPONSE_CODES.success.code}</Badge>} />
            <InfoRow label="ข้อความตอบกลับ" value={RESPONSE_CODES.success.message} />
            <InfoRow label="หมายเลขอ้างอิง (refNo)" value={<code className="text-xs">0126030001234</code>} mono />
            <InfoRow label="API Reference" value={<code className="text-xs">api-ref-2026042000123</code>} mono />
            <InfoRow label="ส่งเมื่อ" value="20/04/2569 14:32:18" />
            <InfoRow label="สถานะแบบ (formStatusId)" value={<Badge variant="outline">1 — รอชำระ</Badge>} />
          </div>

          <div className="bg-emerald-50 rounded-lg p-4 text-sm text-emerald-800">
            <p className="font-medium mb-1">✅ แบบ ภ.พ.30 ของ บริษัท เอบีซี จำกัด ส่งเรียบร้อย</p>
            <p className="text-xs opacity-90">RD จะคืน pay-in slip ให้ภายใน 1-2 นาที — ระบบจะดึงอัตโนมัติด้วย /oapi/payin-form</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">ขั้นตอนถัดไป</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <NextStep done label="ส่งข้อมูลให้ RD" />
          <NextStep done label="RD ตรวจสอบความถูกต้อง" />
          <NextStep current label="ขอ pay-in slip" />
          <NextStep label={`ชำระเงิน ฿${total.toLocaleString()}`} />
          <NextStep label="ขอใบเสร็จจาก RD" />
          <NextStep label="บันทึกบัญชีอัตโนมัติ" />

          <Button className="w-full mt-4 bg-[#fb9678] hover:bg-[#e8856a] text-white" onClick={onNext} data-testid="btn-to-payin">
            ขอ pay-in slip<ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function PayinStage({ onNext, total }: { onNext: () => void; total: number }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-5 h-5" />ชุดชำระเงิน (Pay-In Slip)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center bg-gradient-to-br from-blue-50 to-indigo-50">
            <p className="text-xs text-gray-500 mb-2">QR Payment (Thai QR / Cross-Bank)</p>
            <div className="w-48 h-48 bg-white border border-gray-300 rounded mx-auto flex items-center justify-center">
              <div className="grid grid-cols-12 grid-rows-12 gap-px w-40 h-40">
                {Array.from({ length: 144 }).map((_, i) => (
                  <div key={i} className={Math.random() > 0.5 ? "bg-black" : "bg-white"} />
                ))}
              </div>
            </div>
            <p className="text-2xl font-bold mt-3 text-blue-700">฿{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-gray-500 mt-1">รหัส: 0126030001234 • หมดอายุ 23/04/2569</p>
          </div>
          <Button variant="outline" className="w-full" data-testid="btn-download-slip">
            <Download className="w-4 h-4 mr-2" />ดาวน์โหลดใบ Pay-In Slip (PDF)
          </Button>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">ทางเลือกการชำระเงิน</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <PayMethodCard icon="🏦" title="Direct Debit" desc="ตัดบัญชีลูกค้าอัตโนมัติ (ลูกค้าได้ทำมอบอำนาจไว้แล้ว)" recommended testId="pay-dd" />
          <PayMethodCard icon="📱" title="ส่ง QR ให้ลูกค้า" desc="ส่งผ่านอีเมล/LINE — ลูกค้าสแกนจ่ายเอง" testId="pay-qr" />
          <PayMethodCard icon="🏛️" title="โอนผ่านธนาคาร" desc="พิมพ์ pay-in slip ไปจ่ายที่เคาน์เตอร์ธนาคาร" testId="pay-bank" />

          <div className="pt-3 border-t">
            <Button className="w-full bg-[#fb9678] hover:bg-[#e8856a] text-white" onClick={onNext} data-testid="btn-mark-paid">
              จำลอง: ชำระเรียบร้อย<ArrowRight className="w-4 h-4 ml-1" />
            </Button>
            <p className="text-xs text-gray-400 text-center mt-2">ในการใช้งานจริง — ระบบจะตรวจจับการชำระจาก RD อัตโนมัติ</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CompleteStage({ onViewReceipt }: { onViewReceipt: () => void }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-12 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-12 h-12 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">ยื่นแบบเสร็จสมบูรณ์ 🎉</h2>
        <p className="text-gray-500 mb-6">RD ได้ออกใบเสร็จและภาพแบบ ภ.พ.30 เรียบร้อยแล้ว</p>

        <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-6">
          <ResultBadge icon="📄" label="แบบ ภ.พ.30" sublabel="0126030001234" />
          <ResultBadge icon="🧾" label="ใบเสร็จ" sublabel="RD-262603-0001234" />
          <ResultBadge icon="✅" label="บันทึกบัญชี" sublabel="JV-2026-04-0125" />
        </div>

        <div className="flex gap-2 justify-center">
          <Button variant="outline" data-testid="btn-back-dashboard" onClick={() => window.location.href = "/etax-hub/efiling"}>
            <ArrowLeft className="w-4 h-4 mr-2" />กลับหน้ารวม
          </Button>
          <Button className="bg-[#fb9678] hover:bg-[#e8856a] text-white" onClick={onViewReceipt} data-testid="btn-view-receipt">
            <Receipt className="w-4 h-4 mr-2" />ดูใบเสร็จ + บันทึกบัญชี
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <div className={`text-sm mt-0.5 ${mono ? "font-mono" : "font-medium"}`}>{value}</div>
    </div>
  );
}

function NextStep({ done, current, label }: { done?: boolean; current?: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 ${done ? "text-emerald-700" : current ? "text-[#fb9678] font-medium" : "text-gray-400"}`}>
      {done ? <CheckCircle2 className="w-4 h-4" /> : current ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
      <span>{label}</span>
    </div>
  );
}

function PayMethodCard({ icon, title, desc, recommended, testId }: any) {
  return (
    <div className={`border rounded-lg p-3 cursor-pointer hover:bg-gray-50 ${recommended ? "border-[#fb9678] bg-orange-50/50" : "border-gray-200"}`} data-testid={testId}>
      <div className="flex items-start gap-3">
        <div className="text-2xl">{icon}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">{title}</p>
            {recommended && <Badge className="bg-[#fb9678] text-white text-xs border-0">แนะนำ</Badge>}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
        </div>
      </div>
    </div>
  );
}

function ResultBadge({ icon, label, sublabel }: { icon: string; label: string; sublabel: string }) {
  return (
    <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-4">
      <div className="text-3xl mb-1">{icon}</div>
      <p className="font-medium text-sm">{label}</p>
      <p className="text-xs text-emerald-700 font-mono mt-1">{sublabel}</p>
    </div>
  );
}
