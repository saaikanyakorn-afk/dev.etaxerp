import { useLocation } from "wouter";
import EtaxCenterLayout from "@/components/etax-center-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft, Shield, KeyRound, FileText, Building2, AlertTriangle, CheckCircle2,
  Clock, Calendar, Upload, Download, RefreshCw, ExternalLink,
} from "lucide-react";

export default function EfilingSettings() {
  const [, setLocation] = useLocation();

  return (
    <EtaxCenterLayout>
      <div className="space-y-6 p-6">
        <div>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/etax-hub/efiling")} data-testid="btn-back">
            <ArrowLeft className="w-4 h-4 mr-1" />กลับ
          </Button>
          <h1 className="text-2xl font-bold text-gray-800 mt-2" data-testid="text-settings-title">
            ตั้งค่า e-Filing
          </h1>
          <p className="text-gray-500 text-sm mt-1">จัดการ credential, certificate, และการเชื่อมต่อ RD Open API</p>
        </div>

        <Tabs defaultValue="credential">
          <TabsList className="bg-white border-0 shadow-sm">
            <TabsTrigger value="credential" data-testid="tab-credential">🔑 OA1- Credential</TabsTrigger>
            <TabsTrigger value="cert" data-testid="tab-cert">📜 CA Certificate</TabsTrigger>
            <TabsTrigger value="compliance" data-testid="tab-compliance">🛡️ ETDA Compliance</TabsTrigger>
            <TabsTrigger value="endpoints" data-testid="tab-endpoints">🌐 API Endpoints</TabsTrigger>
          </TabsList>

          <TabsContent value="credential" className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2"><KeyRound className="w-4 h-4" />OA1- Service Provider Credential</span>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">รอ RD ออกให้</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="ชื่อนิติบุคคล" value="บริษัท อี แท็กซ์ เซ็นเตอร์ (ประเทศไทย) จำกัด" />
                <Field label="เลขประจำตัวผู้เสียภาษี" value={<code className="font-mono">0-1055-61017-02-0</code>} />
                <Field label="ภ.อ.01.2 Reference" value={<code className="font-mono">I021000001668</code>} />
                <Field label="ส่งเอกสารที่ RD office ก่อน" value={<span className="text-amber-700 font-medium">20/05/2569 (เหลือ 30 วัน)</span>} />
                <Field label="OA1- Credential" value={<span className="text-gray-400 italic">ยังไม่ได้รับ — RD จะออกให้หลังตรวจ ETDA cert ผ่าน</span>} />

                <div className="bg-amber-50 rounded-lg p-4 text-sm">
                  <p className="font-medium text-amber-900 mb-2 flex items-center gap-1">
                    <Clock className="w-4 h-4" />Timeline ที่คาดการณ์
                  </p>
                  <ol className="text-xs text-amber-800 space-y-1.5 ml-5 list-decimal">
                    <li>ส่ง ภ.อ.01.2 พร้อมเอกสารถึง RD office (ก่อน 20/05/2569)</li>
                    <li>RD ตรวจ paperwork → ออกเลขผู้นำส่งชั่วคราว (2-4 สัปดาห์)</li>
                    <li>ใช้เลขนี้สมัคร CA Certificate + ETDA assessment</li>
                    <li>ผ่าน ETDA → RD ออก OA1- credential จริง (3-6 เดือน)</li>
                    <li>ทดสอบใน sandbox → production</li>
                  </ol>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base">Service Provider Type</CardTitle></CardHeader>
              <CardContent>
                <div className="border-2 border-[#fb9678] bg-orange-50/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-[#fb9678] text-white p-2"><Building2 className="w-5 h-5" /></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">ผู้ให้บริการตัวแทน (Agent SP)</h4>
                        <Badge className="bg-[#fb9678] text-white border-0">เลือกแล้ว</Badge>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        ลงนามแทนลูกค้า • รับ pay-in slip + ใบเสร็จ • ส่งให้ลูกค้า • รองรับ Direct Debit
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        ✓ ใช้ <code>OA1-XXXXXXXXXXXXX</code> เดียวสำหรับทั้ง 447 บริษัท
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cert" className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2"><Shield className="w-4 h-4" />Enterprise Certificate (สำหรับ JWS Signing)</span>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">รอติดตั้ง</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="ผู้ออกใบรับรอง (CA)" value={<span className="text-gray-400 italic">รอเลือก — TDID, INET CA, หรือ CAT</span>} />
                <Field label="Subject (CN)" value={<span className="text-gray-400 italic">บริษัท อี แท็กซ์ เซ็นเตอร์ (ประเทศไทย) จำกัด</span>} />
                <Field label="วันที่ออก" value={<span className="text-gray-400 italic">—</span>} />
                <Field label="วันหมดอายุ" value={<span className="text-gray-400 italic">—</span>} />
                <Field label="Algorithm" value={<><code>RSA 2048-bit</code> + <code>SHA-256</code></>} />
                <Field label="ราคา" value="5,000-15,000 บาท/ปี (ขึ้นกับ CA)" />

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">ลากไฟล์ <code>.p12</code> หรือ <code>.pfx</code> มาวาง</p>
                  <p className="text-xs text-gray-400 mt-1">หรือคลิกเพื่อเลือกไฟล์</p>
                  <Button variant="outline" className="mt-3" data-testid="btn-upload-cert">
                    <Upload className="w-4 h-4 mr-2" />อัปโหลด Certificate
                  </Button>
                </div>

                <div className="bg-blue-50 rounded-lg p-4 text-xs text-blue-800">
                  <p className="font-medium mb-1">🔒 ความปลอดภัย</p>
                  <ul className="space-y-1 ml-4 list-disc">
                    <li>Private key เก็บใน secret store แบบเข้ารหัส (Replit Secrets / KMS)</li>
                    <li>ระบบจะแจ้งเตือนเมื่อใกล้หมดอายุ (30/60/90 วัน)</li>
                    <li>การใช้ cert ทุกครั้ง บันทึก audit log (PDPA + RD compliance)</li>
                    <li>หมุน cert ก่อนหมดอายุได้ — ไม่กระทบการยื่นแบบ</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2"><Shield className="w-4 h-4" />ETDA Compliance — RD STD. [01-2566]</span>
                  <Badge variant="outline">21 หมวด • 93 controls</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {COMPLIANCE_CATEGORIES.map((cat, i) => (
                    <div key={i} className={`border rounded-lg p-3 text-sm ${cat.status === "done" ? "bg-emerald-50 border-emerald-200" : cat.status === "progress" ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs">{cat.name}</p>
                          <p className="text-xs opacity-75 mt-0.5">{cat.desc}</p>
                        </div>
                        {cat.status === "done" ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> :
                         cat.status === "progress" ? <Clock className="w-4 h-4 text-amber-600 shrink-0" /> :
                         <AlertTriangle className="w-4 h-4 text-gray-400 shrink-0" />}
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full mt-4" data-testid="btn-view-full-compliance">
                  <FileText className="w-4 h-4 mr-2" />ดู checklist เต็ม (93 controls)
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="endpoints" className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">RD Open API Endpoints</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {ENDPOINTS.map((ep, i) => (
                  <div key={i} className="flex items-center gap-3 border border-gray-100 rounded-lg p-3">
                    <Badge variant="outline" className="font-mono text-xs">{ep.method}</Badge>
                    <code className="text-sm font-mono flex-1">{ep.path}</code>
                    <span className="text-xs text-gray-500">{ep.desc}</span>
                    <Badge variant="outline" className={ep.implemented ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-500"}>
                      {ep.implemented ? "พร้อมใช้" : "Mock"}
                    </Badge>
                  </div>
                ))}

                <div className="grid grid-cols-2 gap-3 pt-4">
                  <Field label="Production URL" value={<code className="text-xs">https://rdws.rd.go.th</code>} />
                  <Field label="Sandbox URL" value={<code className="text-xs">https://rdws-uat.rd.go.th</code>} />
                </div>

                <div className="bg-gray-50 rounded-lg p-3 mt-3 text-xs">
                  <p className="font-medium mb-2">📡 Connection Test</p>
                  <Button size="sm" variant="outline" disabled data-testid="btn-test-connection">
                    <RefreshCw className="w-3 h-3 mr-2" />ทดสอบการเชื่อมต่อ (ต้องมี OA1- ก่อน)
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </EtaxCenterLayout>
  );
}

const COMPLIANCE_CATEGORIES = [
  { name: "1. Security Policy", desc: "นโยบาย 17 หัวข้อ", status: "todo" },
  { name: "2. Roles & Responsibilities", desc: "CISO + CIO + BCM", status: "todo" },
  { name: "3. Supplier Relationships", desc: "NDA + SLA + 3rd party", status: "progress" },
  { name: "4. Asset Inventory", desc: "Asset register", status: "progress" },
  { name: "5. Information Classification", desc: "PII / Confidential / Public", status: "todo" },
  { name: "6. Information Transfer", desc: "Encrypt in transit", status: "done" },
  { name: "7. Access Control", desc: "RBAC + tenant isolation", status: "done" },
  { name: "8. Identity & Access Mgmt", desc: "Unique ID + periodic review", status: "done" },
  { name: "9. Incident Management", desc: "Cyber Response Plan + BCP", status: "todo" },
  { name: "10. Logging & Evidence", desc: "Audit log + WORM", status: "progress" },
  { name: "11. ICT Readiness for BC", desc: "DR + backup", status: "progress" },
  { name: "12. Records Protection", desc: "Retention policy", status: "progress" },
  { name: "13. Data at Rest", desc: "DB encryption", status: "done" },
  { name: "14. Interface Security", desc: "HTTPS + auth", status: "done" },
  { name: "15. Software Security", desc: "SDLC + dep scan", status: "progress" },
] as const;

const ENDPOINTS = [
  { method: "POST", path: "/oapi/submit-filing-auth", desc: "Login + Token", implemented: false },
  { method: "POST", path: "/oapi/submit-form", desc: "ส่งแบบ", implemented: false },
  { method: "POST", path: "/oapi/payin-form", desc: "ขอ pay-in slip", implemented: false },
  { method: "POST", path: "/oapi/receipt-form", desc: "ขอใบเสร็จ", implemented: false },
  { method: "POST", path: "/oapi/result-form", desc: "เช็คสถานะ", implemented: false },
  { method: "POST", path: "/oapi/cancel-form", desc: "ยกเลิกแบบ", implemented: false },
  { method: "POST", path: "/oapi/set-password", desc: "ตั้ง password", implemented: false },
  { method: "POST", path: "/oapi/change-password", desc: "เปลี่ยน password", implemented: false },
];

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div className="grid grid-cols-3 gap-3 text-sm">
      <p className="text-gray-500">{label}</p>
      <div className="col-span-2 font-medium">{value}</div>
    </div>
  );
}
