import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout";
import SettingsTabs from "@/components/settings-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft, FileText, Mail, Shield, CheckCircle2, AlertTriangle,
  Download, Eye, Info, Loader2
} from "lucide-react";
import { useLocation } from "wouter";

const THAI_PROVINCES: { code: string; name: string }[] = [
  { code: "10", name: "กรุงเทพมหานคร" },
  { code: "11", name: "สมุทรปราการ" },
  { code: "12", name: "นนทบุรี" },
  { code: "13", name: "ปทุมธานี" },
  { code: "14", name: "พระนครศรีอยุธยา" },
  { code: "15", name: "อ่างทอง" },
  { code: "16", name: "ลพบุรี" },
  { code: "17", name: "สิงห์บุรี" },
  { code: "18", name: "ชัยนาท" },
  { code: "19", name: "สระบุรี" },
  { code: "20", name: "ชลบุรี" },
  { code: "21", name: "ระยอง" },
  { code: "22", name: "จันทบุรี" },
  { code: "23", name: "ตราด" },
  { code: "24", name: "ฉะเชิงเทรา" },
  { code: "25", name: "ปราจีนบุรี" },
  { code: "26", name: "นครนายก" },
  { code: "27", name: "สระแก้ว" },
  { code: "30", name: "นครราชสีมา" },
  { code: "31", name: "บุรีรัมย์" },
  { code: "32", name: "สุรินทร์" },
  { code: "33", name: "ศรีสะเกษ" },
  { code: "34", name: "อุบลราชธานี" },
  { code: "35", name: "ยโสธร" },
  { code: "36", name: "ชัยภูมิ" },
  { code: "37", name: "อำนาจเจริญ" },
  { code: "38", name: "บึงกาฬ" },
  { code: "39", name: "หนองบัวลำภู" },
  { code: "40", name: "ขอนแก่น" },
  { code: "41", name: "อุดรธานี" },
  { code: "42", name: "เลย" },
  { code: "43", name: "หนองคาย" },
  { code: "44", name: "มหาสารคาม" },
  { code: "45", name: "ร้อยเอ็ด" },
  { code: "46", name: "กาฬสินธุ์" },
  { code: "47", name: "สกลนคร" },
  { code: "48", name: "นครพนม" },
  { code: "49", name: "มุกดาหาร" },
  { code: "50", name: "เชียงใหม่" },
  { code: "51", name: "ลำพูน" },
  { code: "52", name: "ลำปาง" },
  { code: "53", name: "อุตรดิตถ์" },
  { code: "54", name: "แพร่" },
  { code: "55", name: "น่าน" },
  { code: "56", name: "พะเยา" },
  { code: "57", name: "เชียงราย" },
  { code: "58", name: "แม่ฮ่องสอน" },
  { code: "60", name: "นครสวรรค์" },
  { code: "61", name: "อุทัยธานี" },
  { code: "62", name: "กำแพงเพชร" },
  { code: "63", name: "ตาก" },
  { code: "64", name: "สุโขทัย" },
  { code: "65", name: "พิษณุโลก" },
  { code: "66", name: "พิจิตร" },
  { code: "67", name: "เพชรบูรณ์" },
  { code: "70", name: "ราชบุรี" },
  { code: "71", name: "กาญจนบุรี" },
  { code: "72", name: "สุพรรณบุรี" },
  { code: "73", name: "นครปฐม" },
  { code: "74", name: "สมุทรสาคร" },
  { code: "75", name: "สมุทรสงคราม" },
  { code: "76", name: "เพชรบุรี" },
  { code: "77", name: "ประจวบคีรีขันธ์" },
  { code: "80", name: "นครศรีธรรมราช" },
  { code: "81", name: "กระบี่" },
  { code: "82", name: "พังงา" },
  { code: "83", name: "ภูเก็ต" },
  { code: "84", name: "สุราษฎร์ธานี" },
  { code: "85", name: "ระนอง" },
  { code: "86", name: "ชุมพร" },
  { code: "90", name: "สงขลา" },
  { code: "91", name: "สตูล" },
  { code: "92", name: "ตรัง" },
  { code: "93", name: "พัทลุง" },
  { code: "94", name: "ปัตตานี" },
  { code: "95", name: "ยะลา" },
  { code: "96", name: "นราธิวาส" },
];

interface EtaxSettings {
  etaxEnabled: boolean;
  etaxEmail: string;
  etaxBuyerTestEmail: string;
  etaxTimestampEmail: string;
  sellerTaxIdType: string;
  sellerBranchId: string;
  sellerBuildingName: string;
  sellerBuildingNumber: string;
  sellerPostcode: string;
  sellerDistrictCode: string;
  sellerSubdistrictCode: string;
  sellerProvinceCode: string;
  etaxEmailProvider: string;
  smtpUser: string;
  smtpPass: string;
}

export default function EtaxSettingsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  const [form, setForm] = useState<EtaxSettings>({
    etaxEnabled: false,
    etaxEmail: "",
    etaxBuyerTestEmail: "",
    etaxTimestampEmail: "csemail@etax.teda.th",
    sellerTaxIdType: "TXID",
    sellerBranchId: "00000",
    sellerBuildingName: "",
    sellerBuildingNumber: "",
    sellerPostcode: "",
    sellerDistrictCode: "",
    sellerSubdistrictCode: "",
    sellerProvinceCode: "",
    etaxEmailProvider: "gmail",
    smtpUser: "",
    smtpPass: "",
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/etax/settings", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/etax/settings?companyId=${companyId}`);
      return res.json();
    },
    enabled: !!companyId,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        etaxEnabled: settings.etaxEnabled || false,
        etaxEmail: settings.etaxEmail || "",
        etaxBuyerTestEmail: settings.etaxBuyerTestEmail || "",
        etaxTimestampEmail: settings.etaxTimestampEmail || "csemail@etax.teda.th",
        sellerTaxIdType: (settings as any).sellerTaxIdType || "TXID",
        sellerBranchId: settings.sellerBranchId || "00000",
        sellerBuildingName: settings.sellerBuildingName || "",
        sellerBuildingNumber: settings.sellerBuildingNumber || "",
        sellerPostcode: settings.sellerPostcode || "",
        sellerDistrictCode: settings.sellerDistrictCode || "",
        sellerSubdistrictCode: settings.sellerSubdistrictCode || "",
        sellerProvinceCode: settings.sellerProvinceCode || "",
        etaxEmailProvider: settings.etaxEmailProvider || "gmail",
        smtpUser: settings.smtpUser || "",
        smtpPass: settings.smtpPass || "",
      });
    }
  }, [settings]);

  type ThaiAddressData = {
    provinces: Record<string, string>;
    districts: Record<string, { n: string; p: string }>;
    subdistricts: Record<string, { n: string; d: string }>;
  };

  const { data: thaiAddr } = useQuery<ThaiAddressData>({
    queryKey: ["/api/thai-addresses"],
    queryFn: async () => {
      const res = await fetch("/api/thai-addresses");
      return res.json();
    },
    staleTime: Infinity,
  });

  const filteredDistricts = useMemo(() => {
    if (!thaiAddr?.districts || !form.sellerProvinceCode) return [];
    return Object.entries(thaiAddr.districts)
      .filter(([, v]) => v.p === form.sellerProvinceCode)
      .map(([code, v]) => ({ code, name: v.n }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [thaiAddr, form.sellerProvinceCode]);

  const filteredSubdistricts = useMemo(() => {
    if (!thaiAddr?.subdistricts || !form.sellerDistrictCode) return [];
    return Object.entries(thaiAddr.subdistricts)
      .filter(([, v]) => v.d === form.sellerDistrictCode)
      .map(([code, v]) => ({ code, name: v.n }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [thaiAddr, form.sellerDistrictCode]);

  const saveMutation = useMutation({
    mutationFn: async (data: EtaxSettings) => {
      const res = await apiRequest("POST", "/api/etax/settings", { ...data, companyId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/etax/settings"] });
      toast({ title: "บันทึกการตั้งค่า e-Tax Invoice สำเร็จ" });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const testXmlMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/etax/test-xml", { companyId });
      return res.json();
    },
    onSuccess: (data) => {
      const blob = new Blob([data.xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename || "etax-test.xml";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "สร้าง XML ตัวอย่างสำเร็จ" });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <Layout>
        <SettingsTabs />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SettingsTabs />
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/settings")} data-testid="btn-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">
              ตั้งค่า e-Tax Invoice (PDF/A-3)
            </h1>
            <p className="text-sm text-gray-500">
              ใบกำกับภาษีอิเล็กทรอนิกส์ตามมาตรฐาน สพธอ. / กรมสรรพากร
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4" data-testid="info-etax-overview">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-700 space-y-1">
              <p className="font-medium">เกี่ยวกับ e-Tax Invoice by Email</p>
              <p>ระบบจะสร้างใบกำกับภาษีในรูปแบบ PDF/A-3 ที่ฝัง XML ตามมาตรฐาน ขมธอ. 3-2560 ไว้ภายในไฟล์ PDF แล้วส่งผ่าน Email ไปยังผู้ซื้อ พร้อม CC ไปยังระบบ Time Stamp ของ สพธอ.</p>
              <p>ขั้นตอนการใช้งาน: ลงทะเบียนกับกรมสรรพากร → ตั้งค่า Email ที่ได้รับอนุมัติ → สร้าง PDF/A-3 → ส่ง Email</p>
              <a
                href="https://www.etax.teda.th/index.php"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800"
              >
                ข้อมูลเพิ่มเติมจาก สพธอ. →
              </a>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border shadow-sm divide-y">
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Shield className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">เปิดใช้งาน e-Tax Invoice</h3>
                  <p className="text-sm text-gray-500">แสดงตราประทับ e-Tax บนเอกสาร และเปิดปุ่มส่ง e-Tax</p>
                </div>
              </div>
              <Switch
                checked={form.etaxEnabled}
                onCheckedChange={(checked) => setForm({ ...form, etaxEnabled: checked })}
                data-testid="switch-etax-enabled"
              />
            </div>
          </div>

          {form.etaxEnabled && (
            <>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <h3 className="font-semibold text-gray-800">ตั้งค่า Email</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email ผู้ขาย (ลงทะเบียนกับกรมสรรพากร)
                    </label>
                    <Input
                      value={form.etaxEmail}
                      onChange={(e) => setForm({ ...form, etaxEmail: e.target.value })}
                      placeholder="seller@company.co.th"
                      data-testid="input-etax-email"
                    />
                    <p className="text-xs text-gray-400 mt-1">Email ที่ได้รับอนุมัติจากกรมสรรพากร</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email ระบบ Time Stamp (CC)
                    </label>
                    <Input
                      value={form.etaxTimestampEmail}
                      onChange={(e) => setForm({ ...form, etaxTimestampEmail: e.target.value })}
                      placeholder="csemail@etax.teda.th"
                      data-testid="input-timestamp-email"
                    />
                    <p className="text-xs text-gray-400 mt-1">ค่าเริ่มต้น: csemail@etax.teda.th</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email ผู้ซื้อสำหรับทดสอบ
                  </label>
                  <Input
                    value={form.etaxBuyerTestEmail}
                    onChange={(e) => setForm({ ...form, etaxBuyerTestEmail: e.target.value })}
                    placeholder="test-buyer@example.com"
                    data-testid="input-test-buyer-email"
                  />
                  <p className="text-xs text-gray-400 mt-1">ใช้ทดสอบการส่ง e-Tax Invoice ก่อนใช้จริง (ถ้าว่าง จะส่งไปที่ Email ผู้ซื้อจริง)</p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-3">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <h4 className="font-semibold text-gray-800">วิธีการส่ง Email</h4>
                </div>

                <div className="flex gap-3 mb-4">
                  <button
                    type="button"
                    className={`flex-1 p-3 rounded-lg border-2 text-left transition-all ${
                      form.etaxEmailProvider === "gmail"
                        ? "border-[#fb9678] bg-orange-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => setForm({ ...form, etaxEmailProvider: "gmail" })}
                    data-testid="btn-provider-gmail"
                  >
                    <div className="font-medium text-sm">Gmail / SMTP</div>
                    <div className="text-xs text-gray-500 mt-1">ส่งผ่าน Gmail (App Password) — CC ได้ตามระเบียบ</div>
                  </button>
                  <button
                    type="button"
                    className={`flex-1 p-3 rounded-lg border-2 text-left transition-all ${
                      form.etaxEmailProvider === "resend"
                        ? "border-[#fb9678] bg-orange-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => setForm({ ...form, etaxEmailProvider: "resend" })}
                    data-testid="btn-provider-resend"
                  >
                    <div className="font-medium text-sm">Resend API</div>
                    <div className="text-xs text-gray-500 mt-1">ส่งผ่าน Resend — ต้องลงทะเบียน domain</div>
                  </button>
                </div>

                {form.etaxEmailProvider === "gmail" && (
                  <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Gmail Address
                      </label>
                      <Input
                        value={form.smtpUser}
                        onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
                        placeholder="etaxcenter.th@gmail.com"
                        data-testid="input-smtp-user"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        App Password (16 ตัวอักษร)
                      </label>
                      <Input
                        type="password"
                        value={form.smtpPass}
                        onChange={(e) => setForm({ ...form, smtpPass: e.target.value })}
                        placeholder="xxxx xxxx xxxx xxxx"
                        data-testid="input-smtp-pass"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        สร้างที่ Google Account → Security → 2-Step Verification → App passwords
                      </p>
                    </div>
                  </div>
                )}

                {form.etaxEmailProvider === "resend" && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-700">
                      ใช้ Resend API Key และ From Email จากการตั้งค่าระบบ (Environment Variables)
                    </p>
                    <p className="text-xs text-yellow-600 mt-1">
                      ⚠ อีเมลทดสอบ (onboarding@resend.dev) ส่งได้เฉพาะอีเมลเจ้าของ account — ลงทะเบียน domain จึงจะ CC ได้
                    </p>
                  </div>
                )}
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-gray-500" />
                  <h3 className="font-semibold text-gray-800">ข้อมูลผู้ขาย (สำหรับ XML)</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ประเภทผู้ขาย
                    </label>
                    <select
                      value={form.sellerTaxIdType}
                      onChange={(e) => setForm({ ...form, sellerTaxIdType: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      data-testid="select-seller-type"
                    >
                      <option value="TXID">นิติบุคคล (Tax ID)</option>
                      <option value="NIDN">บุคคลธรรมดา (ID Card)</option>
                    </select>
                    <p className="text-xs text-gray-400 mt-1">TXID = นิติบุคคล, NIDN = บุคคลธรรมดา</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      รหัสสาขา (Branch ID)
                    </label>
                    <Input
                      value={form.sellerBranchId}
                      onChange={(e) => setForm({ ...form, sellerBranchId: e.target.value })}
                      placeholder="00000"
                      maxLength={5}
                      data-testid="input-branch-id"
                      disabled={form.sellerTaxIdType === "NIDN"}
                    />
                    <p className="text-xs text-gray-400 mt-1">{form.sellerTaxIdType === "NIDN" ? "บุคคลธรรมดาไม่มีสาขา" : "สำนักงานใหญ่ = 00000"}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      บ้านเลขที่ (BuildingNumber) <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={form.sellerBuildingNumber}
                      onChange={(e) => setForm({ ...form, sellerBuildingNumber: e.target.value })}
                      placeholder="123/45"
                      data-testid="input-building-number"
                    />
                    <p className="text-xs text-gray-400 mt-1">ETDA บังคับ — เลขที่ตั้งสถานประกอบการ</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ชื่ออาคาร
                    </label>
                    <Input
                      value={form.sellerBuildingName}
                      onChange={(e) => setForm({ ...form, sellerBuildingName: e.target.value })}
                      placeholder="อาคาร..."
                      data-testid="input-building-name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      รหัสไปรษณีย์ <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={form.sellerPostcode}
                      onChange={(e) => setForm({ ...form, sellerPostcode: e.target.value })}
                      placeholder="10900"
                      maxLength={5}
                      data-testid="input-postcode"
                    />
                    <p className="text-xs text-gray-400 mt-1">5 หลัก</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      จังหวัด <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.sellerProvinceCode}
                      onChange={(e) => {
                        const pCode = e.target.value;
                        setForm({ ...form, sellerProvinceCode: pCode, sellerDistrictCode: "", sellerSubdistrictCode: "" });
                      }}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      data-testid="select-province-code"
                    >
                      <option value="">-- เลือกจังหวัด --</option>
                      {THAI_PROVINCES.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.code} - {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      อำเภอ/เขต <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.sellerDistrictCode}
                      onChange={(e) => {
                        const dCode = e.target.value;
                        setForm({ ...form, sellerDistrictCode: dCode, sellerSubdistrictCode: "" });
                      }}
                      disabled={!form.sellerProvinceCode}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                      data-testid="select-district-code"
                    >
                      <option value="">-- เลือกอำเภอ/เขต --</option>
                      {filteredDistricts.map((d) => (
                        <option key={d.code} value={d.code}>
                          {d.code} - {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ตำบล/แขวง <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.sellerSubdistrictCode}
                      onChange={(e) => setForm({ ...form, sellerSubdistrictCode: e.target.value })}
                      disabled={!form.sellerDistrictCode}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                      data-testid="select-subdistrict-code"
                    >
                      <option value="">-- เลือกตำบล/แขวง --</option>
                      {filteredSubdistricts.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.code} - {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {form.etaxEnabled && (
              <Button
                variant="outline"
                onClick={() => testXmlMutation.mutate()}
                disabled={testXmlMutation.isPending}
                className="border-blue-300 text-blue-600 hover:bg-blue-50"
                data-testid="btn-test-xml"
              >
                {testXmlMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                ดาวน์โหลด XML ตัวอย่าง
              </Button>
            )}
          </div>
          <Button
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
            className="bg-[#fb9678] hover:bg-[#e8866a] text-white"
            data-testid="btn-save-etax"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            บันทึกการตั้งค่า
          </Button>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            ขั้นตอนการลงทะเบียน e-Tax Invoice by Email
          </h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-[#fb9678] text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
              <div>
                <p className="font-medium text-gray-800">ลงทะเบียนกับกรมสรรพากร</p>
                <p>ยื่นคำขอผ่านระบบอิเล็กทรอนิกส์ที่ <a href="http://interapp3.rd.go.th/signed_inter/src_inter/main2.php" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">rd.go.th</a> เพื่อขอรายชื่อเป็นผู้มีสิทธิจัดทำใบกำกับภาษีอิเล็กทรอนิกส์</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-[#fb9678] text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
              <div>
                <p className="font-medium text-gray-800">แจ้ง Email ที่จะใช้ส่ง</p>
                <p>แจ้ง Email Address ที่จะใช้จัดทำใบกำกับภาษี ผ่านระบบอิเล็กทรอนิกส์ของกรมสรรพากร</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-[#fb9678] text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
              <div>
                <p className="font-medium text-gray-800">ทดสอบกับ สพธอ.</p>
                <p>ส่ง Email แจ้งข้อมูลไปที่ <a href="mailto:eservice@etda.or.th" className="text-blue-600 underline">eservice@etda.or.th</a> เพื่อนัดทดสอบระบบ</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-[#fb9678] text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
              <div>
                <p className="font-medium text-gray-800">เริ่มใช้งานจริง</p>
                <p>เปิดใช้งาน e-Tax Invoice ในการตั้งค่านี้ กดปุ่ม "ส่ง e-Tax" บนใบกำกับภาษีที่ต้องการส่ง</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4" data-testid="info-etax-format">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-700 space-y-1">
              <p className="font-medium">ข้อกำหนดรูปแบบ e-Tax Invoice</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>1 ใบกำกับภาษี = 1 ไฟล์ PDF/A-3 ขนาดไม่เกิน 3 MB</li>
                <li>ห้ามใช้การถ่ายภาพหรือ scan เอกสารกระดาษ</li>
                <li>Email Subject: [วันเดือนปี][INV][เลขที่ใบกำกับภาษี]</li>
                <li>ใบเพิ่มหนี้: [วันเดือนปี][DBN][เลขที่][เลขที่เดิม]</li>
                <li>ใบลดหนี้: [วันเดือนปี][CRN][เลขที่][เลขที่เดิม]</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-5" data-testid="etax-preview-section">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Eye className="h-4 w-4" />
            ตัวอย่างตราประทับ e-Tax Invoice
          </h3>
          <div className="flex items-center gap-2 border border-green-300 rounded px-3 py-2 bg-green-50/50 w-fit">
            <img
              src="/etax-stamp.png"
              alt="e-Tax Invoice"
              className="h-6 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).alt = 'ไม่พบรูปภาพ'; }}
            />
            <div className="text-[9px] leading-tight text-gray-600">
              <div>ใบกำกับภาษีอิเล็กทรอนิกส์นี้ได้จัดทำและส่งข้อมูลให้แก่</div>
              <div>กรมสรรพากรด้วยวิธีการทางอิเล็กทรอนิกส์</div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
