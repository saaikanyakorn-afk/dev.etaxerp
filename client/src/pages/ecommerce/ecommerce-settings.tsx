import EcommerceLayout from "@/components/ecommerce-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building2, Save, Loader2, Phone, Mail, Globe, MapPin, FileText,
  FileImage, Upload, X, Settings, Receipt, BookOpen, Truck, Shield
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import { useUpload } from "@/hooks/use-upload";
import { objectPathToUrl } from "@/lib/utils";
import type { Company } from "@shared/schema";

interface DocSettings {
  id?: number;
  companyId: number;
  logoUrl?: string | null;
  showLogo: boolean;
  showSignature: boolean;
  showTaxId: boolean;
  showBranch: boolean;
  headerNote?: string | null;
  footerNote?: string | null;
  signatureUrl?: string | null;
  ecDocPrefix?: string | null;
  ecReceiptShowLogo?: boolean;
  ecReceiptHeaderText?: string | null;
  ecReceiptFooterText?: string | null;
  ecReceiptFontSize?: string;
  ecReceiptShowCompanyInfo?: boolean;
  ecReceiptShowQr?: boolean;
}

const EC_FONT_SIZES: Record<string, { base: string; total: string; label: string }> = {
  small: { base: "11px", total: "14px", label: "เล็ก (11px)" },
  medium: { base: "12px", total: "16px", label: "กลาง (12px)" },
  large: { base: "14px", total: "18px", label: "ใหญ่ (14px) — แนะนำ" },
  xlarge: { base: "16px", total: "20px", label: "ใหญ่พิเศษ (16px)" },
};

function EcDocPreview({ settings, company }: { settings: DocSettings; company: any }) {
  const fontConf = EC_FONT_SIZES[settings.ecReceiptFontSize || "large"] || EC_FONT_SIZES.large;
  const fontSize = fontConf.base;

  return (
    <div
      className="bg-white mx-auto shadow-md border"
      style={{ width: 320, fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif", fontSize, lineHeight: "1.5" }}
      data-testid="ec-doc-preview"
    >
      {(settings.ecReceiptShowLogo ?? true) && settings.logoUrl && (
        <div className="pt-4 pb-2 text-center">
          <img src={objectPathToUrl(settings.logoUrl!) || settings.logoUrl!} alt="Logo" className="max-h-14 mx-auto object-contain" />
        </div>
      )}

      {(settings.ecReceiptShowCompanyInfo ?? true) && company && (
        <div className="text-center px-5 pb-3" style={{ fontSize }}>
          <div className="font-bold text-base mb-0.5">{company.name || "ชื่อร้าน"}</div>
          {company.address && <div className="text-gray-600 leading-snug">{company.address}</div>}
          {company.phone && <div className="text-gray-500">โทร {company.phone}</div>}
          {company.taxId && <div className="text-gray-500">เลขผู้เสียภาษี {company.taxId}</div>}
        </div>
      )}

      {settings.ecReceiptHeaderText && (
        <div className="text-center px-5 pb-2 text-gray-500 whitespace-pre-line" style={{ fontSize }}>
          {settings.ecReceiptHeaderText}
        </div>
      )}

      <div className="border-t border-dashed border-gray-400 mx-3" />

      <div className="px-5 py-2 text-center" style={{ fontSize }}>
        <div className="font-bold">ใบกำกับภาษีอย่างย่อ</div>
        <div className="text-gray-500">{settings.ecDocPrefix || "EC"}-TIV-250402-0001</div>
      </div>

      <div className="border-t border-dashed border-gray-400 mx-3" />

      <div className="px-5 py-3 space-y-2" style={{ fontSize }}>
        <div className="text-gray-500 mb-1">ออเดอร์: SHP-250401-8821</div>
        <div className="text-gray-500 mb-2">แพลตฟอร์ม: Shopee</div>
        {[
          { name: "เสื้อยืดคอกลม Size L", qty: 2, price: 299 },
          { name: "กางเกงขาสั้น Free Size", qty: 1, price: 450 },
        ].map((item, i) => (
          <div key={i}>
            <div className="font-medium">{item.name}</div>
            <div className="flex justify-between text-gray-600">
              <span>{item.qty} x ฿{item.price.toFixed(2)}</span>
              <span>฿{(item.qty * item.price).toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-gray-400 mx-3" />

      <div className="px-5 py-3 space-y-1" style={{ fontSize }}>
        <div className="flex justify-between text-gray-500">
          <span>ค่าจัดส่ง</span><span>฿0.00</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>ส่วนลด</span><span>-฿50.00</span>
        </div>
        <div className="flex justify-between font-bold" style={{ fontSize: fontConf.total }}>
          <span>รวมทั้งหมด</span>
          <span>฿998.00</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>ภาษีมูลค่าเพิ่ม 7%</span>
          <span>฿65.33</span>
        </div>
      </div>

      {(settings.ecReceiptShowQr ?? false) && (
        <>
          <div className="border-t border-dashed border-gray-400 mx-3" />
          <div className="py-3 text-center">
            <div className="w-20 h-20 mx-auto border-2 border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center">
              <Receipt className="w-10 h-10 text-gray-300" />
            </div>
            <div className="text-xs text-gray-400 mt-1">QR ติดตามพัสดุ</div>
          </div>
        </>
      )}

      {settings.ecReceiptFooterText && (
        <>
          <div className="border-t border-dashed border-gray-400 mx-3" />
          <div className="px-5 py-3 text-center text-gray-500 leading-snug whitespace-pre-line" style={{ fontSize }}>
            {settings.ecReceiptFooterText}
          </div>
        </>
      )}

      <div className="border-t border-dashed border-gray-400 mx-3" />
      <div className="px-5 py-2 flex justify-between text-gray-400" style={{ fontSize: "12px" }}>
        <span>02/04/68 14:30 น.</span>
        <span>Shopee #{settings.ecDocPrefix || "EC"}-0001</span>
      </div>
    </div>
  );
}

function ImageUploadBox({ label, currentUrl, onUploaded, onClear, testId }: {
  label: string; currentUrl?: string | null; onUploaded: (path: string) => void; onClear: () => void; testId: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading } = useUpload({ onSuccess: (r) => onUploaded(r.objectPath) });

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("ไฟล์ต้องมีขนาดไม่เกิน 5MB"); return; }
    await uploadFile(file);
    if (fileRef.current) fileRef.current.value = "";
  }, [uploadFile]);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {currentUrl ? (
        <div className="relative border rounded-lg p-3 bg-muted/30">
          <img src={currentUrl} alt={label} className="max-h-24 max-w-full object-contain mx-auto" data-testid={`img-${testId}`} />
          <Button variant="ghost" size="sm" className="absolute top-1 right-1 h-6 w-6 p-0 text-muted-foreground hover:text-rose-500" onClick={onClear} data-testid={`button-clear-${testId}`}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div
          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-[#fb9678] hover:bg-[#fb9678]/5 transition-colors"
          onClick={() => fileRef.current?.click()}
          data-testid={`dropzone-${testId}`}
        >
          {isUploading ? (
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          ) : (
            <>
              <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-xs text-muted-foreground">คลิกเพื่ออัพโหลด (PNG, JPG ไม่เกิน 5MB)</p>
            </>
          )}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
    </div>
  );
}

export default function EcommerceSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedCompanyId, selectedCompany: company, companies } = useCompany();
  const isLoading = !companies || companies.length === 0;

  const [companyForm, setCompanyForm] = useState({
    name: "", nameEn: "", address: "", addressEn: "",
    phone: "", email: "", taxId: "", branch: "",
    website: "", lineId: "", facebook: "", instagram: "", tiktok: "",
    vatRegistered: false, businessType: "mixed",
    autoTivOnShipped: false,
    ecDailySummaryMode: false,
  });

  useEffect(() => {
    if (company) {
      setCompanyForm({
        name: company.name || "",
        nameEn: (company as any).nameEn || "",
        address: company.address || "",
        addressEn: (company as any).addressEn || "",
        phone: company.phone || "",
        email: (company as any).email || "",
        taxId: company.taxId || "",
        branch: (company as any).branch || "",
        website: (company as any).website || "",
        lineId: (company as any).lineId || "",
        facebook: (company as any).facebook || "",
        instagram: (company as any).instagram || "",
        tiktok: (company as any).tiktok || "",
        vatRegistered: (company as any).vatRegistered || false,
        businessType: company.businessType || "mixed",
        autoTivOnShipped: (company as any).autoTivOnShipped || false,
        ecDailySummaryMode: (company as any).ecDailySummaryMode || false,
      });
    }
  }, [company]);

  const companySaveMutation = useMutation({
    mutationFn: async (data: typeof companyForm) => {
      const r = await fetch(`/api/companies/${selectedCompanyId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("บันทึกไม่สำเร็จ");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "บันทึกสำเร็จ", description: "อัปเดตข้อมูลบริษัทเรียบร้อย", variant: "success" as any });
    },
    onError: () => toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถบันทึกข้อมูลได้", variant: "destructive" }),
  });

  const { data: docSettings } = useQuery<DocSettings>({
    queryKey: ["/api/document-settings", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/document-settings/${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return { companyId: selectedCompanyId!, showLogo: true, showSignature: true, showTaxId: true, showBranch: true };
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const [localDocSettings, setLocalDocSettings] = useState<DocSettings | null>(null);
  useEffect(() => { if (docSettings) setLocalDocSettings(docSettings); }, [docSettings]);

  const docSettingsMutation = useMutation({
    mutationFn: async (data: Partial<DocSettings>) => {
      const r = await fetch(`/api/document-settings/${selectedCompanyId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ ...data, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error("บันทึกไม่สำเร็จ");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-settings", selectedCompanyId] });
      toast({ title: "บันทึกสำเร็จ", description: "อัปเดตตั้งค่าเอกสารเรียบร้อย", variant: "success" as any });
    },
    onError: () => toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" }),
  });

  const { data: accountingModeData } = useQuery<Company>({
    queryKey: ["/api/companies", selectedCompanyId, "detail"],
    queryFn: async () => {
      const r = await fetch(`/api/companies/${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) throw new Error();
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const toggleAccountingMode = useMutation({
    mutationFn: async (newMode: string) => {
      const r = await fetch(`/api/companies/${selectedCompanyId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ accountingMode: newMode }),
      });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies", selectedCompanyId, "detail"] });
      toast({ title: "บันทึกสำเร็จ", variant: "success" as any });
    },
  });

  const { data: etaxData, isLoading: etaxLoading } = useQuery({
    queryKey: ["/api/etax/settings", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/etax/settings?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });
  const [etaxForm, setEtaxForm] = useState<any>(null);
  const [etaxSaving, setEtaxSaving] = useState(false);
  useEffect(() => { if (etaxData) setEtaxForm(etaxData); }, [etaxData]);

  const handleSaveEtax = async () => {
    if (!etaxForm || !selectedCompanyId) return;
    setEtaxSaving(true);
    try {
      const r = await fetch("/api/etax/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...etaxForm, companyId: selectedCompanyId }),
      });
      if (!r.ok) {
        const err = await r.json();
        toast({ title: "บันทึกไม่สำเร็จ", description: err.message, variant: "destructive" });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/etax/settings", selectedCompanyId] });
        toast({ title: "บันทึกการตั้งค่า e-Tax สำเร็จ" });
      }
    } catch (err: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    } finally {
      setEtaxSaving(false);
    }
  };

  const set = (key: string, val: string | boolean) => setCompanyForm(prev => ({ ...prev, [key]: val }));
  const updateDocLocal = (key: string, val: any) => setLocalDocSettings(prev => prev ? { ...prev, [key]: val } : prev);

  if (isLoading) {
    return (
      <EcommerceLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </EcommerceLayout>
    );
  }

  const currentMode = accountingModeData?.accountingMode || "full_accounting";

  return (
    <EcommerceLayout>
      <div className="space-y-4 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#fb9678" }}>
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-settings-title">ตั้งค่า eCommerce</h1>
            <p className="text-sm text-muted-foreground">จัดการข้อมูลบริษัท เอกสาร และโหมดบัญชี</p>
          </div>
        </div>

        <Tabs defaultValue="company" className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full max-w-lg">
            <TabsTrigger value="company" data-testid="tab-company">ข้อมูลบริษัท</TabsTrigger>
            <TabsTrigger value="document" data-testid="tab-document">เอกสาร</TabsTrigger>
            <TabsTrigger value="accounting" data-testid="tab-accounting">โหมดบัญชี</TabsTrigger>
            <TabsTrigger value="etax" data-testid="tab-etax">e-Tax</TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => companySaveMutation.mutate(companyForm)} disabled={companySaveMutation.isPending} data-testid="button-save-company">
                {companySaveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                บันทึก
              </Button>
            </div>

            <Card className="rounded-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" style={{ color: "#03c9d7" }} />
                  ข้อมูลทั่วไป
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">ชื่อบริษัท (ไทย)</Label>
                    <Input value={companyForm.name} onChange={e => set("name", e.target.value)} data-testid="input-company-name" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">ชื่อบริษัท (อังกฤษ)</Label>
                    <Input value={companyForm.nameEn} onChange={e => set("nameEn", e.target.value)} data-testid="input-company-name-en" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <FileText className="h-3 w-3" /> เลขประจำตัวผู้เสียภาษี
                    </Label>
                    <Input value={companyForm.taxId} onChange={e => set("taxId", e.target.value)} placeholder="0105561017020" data-testid="input-tax-id" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">สาขา</Label>
                    <Input value={companyForm.branch || "สำนักงานใหญ่"} onChange={e => set("branch", e.target.value)} data-testid="input-branch" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">ประเภทธุรกิจ</Label>
                  <Select value={companyForm.businessType} onValueChange={v => set("businessType", v)}>
                    <SelectTrigger data-testid="select-business-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mixed">ทั่วไป (ซื้อ-ขาย + บริการ)</SelectItem>
                      <SelectItem value="product">ซื้อมา-ขายไป</SelectItem>
                      <SelectItem value="service">ให้บริการ</SelectItem>
                      <SelectItem value="manufacturing">ผลิต</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-emerald-200 bg-emerald-50/30">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-emerald-600" />
                  ภาษีมูลค่าเพิ่ม (VAT)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{companyForm.vatRegistered ? "จดทะเบียน VAT แล้ว" : "ไม่จดทะเบียน VAT"}</p>
                    <p className="text-xs text-muted-foreground">{companyForm.vatRegistered ? "เอกสารขายจะใส่ VAT 7% อัตโนมัติ" : "เอกสารขายจะใส่ภาษี 0%"}</p>
                  </div>
                  <Switch
                    checked={companyForm.vatRegistered}
                    onCheckedChange={v => set("vatRegistered", v)}
                    data-testid="switch-vat-registered"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-blue-200 bg-blue-50/30">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="h-4 w-4 text-blue-600" />
                  ออกใบกำกับภาษีอัตโนมัติ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{companyForm.autoTivOnShipped ? "เปิดใช้งาน" : "ปิดใช้งาน"}</p>
                    <p className="text-xs text-muted-foreground">
                      {companyForm.autoTivOnShipped
                        ? "สร้างใบกำกับภาษี (TIV) อัตโนมัติเมื่อออเดอร์เปลี่ยนสถานะเป็น \"จัดส่งแล้ว\" พร้อมบันทึกบัญชีอัตโนมัติ"
                        : "ต้องสร้างใบกำกับภาษีด้วยตนเองสำหรับแต่ละออเดอร์"}
                    </p>
                  </div>
                  <Switch
                    checked={companyForm.autoTivOnShipped}
                    onCheckedChange={v => set("autoTivOnShipped", v)}
                    data-testid="switch-auto-tiv"
                  />
                </div>
                {companyForm.autoTivOnShipped && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div>
                      <p className="text-sm font-medium">{companyForm.ecDailySummaryMode ? "สรุปรายวัน" : "ลงบัญชีทีละใบ"}</p>
                      <p className="text-xs text-muted-foreground">
                        {companyForm.ecDailySummaryMode
                          ? "รวมใบกำกับอย่างย่อเป็นใบสรุปรายวัน 1 ใบต่อแพลตฟอร์ม → ลง journal จากใบสรุป (แนะนำ)"
                          : "สร้าง journal entry ทุกใบทันทีที่ออกใบกำกับภาษี"}
                      </p>
                    </div>
                    <Switch
                      checked={companyForm.ecDailySummaryMode}
                      onCheckedChange={v => set("ecDailySummaryMode", v)}
                      data-testid="switch-ec-daily-summary"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-green-600" />
                  ที่อยู่
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">ที่อยู่ (ไทย)</Label>
                  <Textarea value={companyForm.address} onChange={e => set("address", e.target.value)} rows={2} data-testid="input-address" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">ที่อยู่ (อังกฤษ)</Label>
                  <Textarea value={companyForm.addressEn} onChange={e => set("addressEn", e.target.value)} rows={2} data-testid="input-address-en" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="h-4 w-4 text-amber-600" />
                  ช่องทางติดต่อ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">เบอร์โทรศัพท์</Label>
                    <Input value={companyForm.phone} onChange={e => set("phone", e.target.value)} placeholder="099-496-5000" data-testid="input-phone" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">อีเมล</Label>
                    <Input value={companyForm.email} onChange={e => set("email", e.target.value)} placeholder="info@company.co.th" data-testid="input-email" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">เว็บไซต์</Label>
                    <Input value={companyForm.website} onChange={e => set("website", e.target.value)} data-testid="input-website" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">LINE ID</Label>
                    <Input value={companyForm.lineId} onChange={e => set("lineId", e.target.value)} placeholder="@company" data-testid="input-line" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Facebook</Label>
                    <Input value={companyForm.facebook} onChange={e => set("facebook", e.target.value)} data-testid="input-facebook" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Instagram</Label>
                    <Input value={companyForm.instagram} onChange={e => set("instagram", e.target.value)} data-testid="input-instagram" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="document" className="space-y-4">
            <div className="flex justify-end">
              <Button
                onClick={() => localDocSettings && docSettingsMutation.mutate(localDocSettings)}
                disabled={docSettingsMutation.isPending}
                data-testid="button-save-doc-settings"
              >
                {docSettingsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                บันทึก
              </Button>
            </div>

            <Card className="rounded-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileImage className="h-4 w-4" style={{ color: "#fb9678" }} />
                  โลโก้และลายเซ็น
                </CardTitle>
                <p className="text-xs text-muted-foreground">อัพโหลดโลโก้บริษัทและลายเซ็นเพื่อแสดงบนใบกำกับภาษีที่ออกจากระบบ</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ImageUploadBox
                    label="โลโก้บริษัท"
                    currentUrl={localDocSettings?.logoUrl}
                    onUploaded={(path) => updateDocLocal("logoUrl", path)}
                    onClear={() => updateDocLocal("logoUrl", null)}
                    testId="logo"
                  />
                  <ImageUploadBox
                    label="ลายเซ็น"
                    currentUrl={localDocSettings?.signatureUrl}
                    onUploaded={(path) => updateDocLocal("signatureUrl", path)}
                    onClear={() => updateDocLocal("signatureUrl", null)}
                    testId="signature"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" style={{ color: "#03c9d7" }} />
                  ตัวเลือกแสดงบนเอกสาร
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">แสดงโลโก้</p>
                    <p className="text-xs text-muted-foreground">แสดงโลโก้บริษัทบนเอกสาร</p>
                  </div>
                  <Switch
                    checked={localDocSettings?.showLogo ?? true}
                    onCheckedChange={v => updateDocLocal("showLogo", v)}
                    data-testid="switch-show-logo"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">แสดงลายเซ็น</p>
                    <p className="text-xs text-muted-foreground">แสดงลายเซ็นอิเล็กทรอนิกส์บนเอกสาร</p>
                  </div>
                  <Switch
                    checked={localDocSettings?.showSignature ?? true}
                    onCheckedChange={v => updateDocLocal("showSignature", v)}
                    data-testid="switch-show-signature"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">แสดงเลขผู้เสียภาษี</p>
                    <p className="text-xs text-muted-foreground">แสดงเลขประจำตัวผู้เสียภาษีบนเอกสาร</p>
                  </div>
                  <Switch
                    checked={localDocSettings?.showTaxId ?? true}
                    onCheckedChange={v => updateDocLocal("showTaxId", v)}
                    data-testid="switch-show-taxid"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">แสดงสาขา</p>
                    <p className="text-xs text-muted-foreground">แสดงข้อมูลสาขาบนเอกสาร</p>
                  </div>
                  <Switch
                    checked={localDocSettings?.showBranch ?? true}
                    onCheckedChange={v => updateDocLocal("showBranch", v)}
                    data-testid="switch-show-branch"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-600" />
                  ข้อความบนเอกสาร
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">หมายเหตุหัวเอกสาร</Label>
                  <Textarea
                    value={localDocSettings?.headerNote || ""}
                    onChange={e => updateDocLocal("headerNote", e.target.value)}
                    rows={2} placeholder="ข้อความที่จะแสดงด้านบนเอกสาร"
                    data-testid="input-header-note"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">หมายเหตุท้ายเอกสาร</Label>
                  <Textarea
                    value={localDocSettings?.footerNote || ""}
                    onChange={e => updateDocLocal("footerNote", e.target.value)}
                    rows={2} placeholder="ข้อความที่จะแสดงด้านล่างเอกสาร"
                    data-testid="input-footer-note"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="rounded-xl border-cyan-200 bg-cyan-50/30">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-cyan-600" />
                    ตั้งค่าเอกสาร eCommerce
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Prefix ขนาดตัวอักษร และข้อความสำหรับเอกสาร eCommerce</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">ขนาดตัวอักษร</Label>
                      <Select
                        value={localDocSettings?.ecReceiptFontSize || "large"}
                        onValueChange={v => updateDocLocal("ecReceiptFontSize", v)}
                      >
                        <SelectTrigger data-testid="select-ec-font-size"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(EC_FONT_SIZES).map(([key, conf]) => (
                            <SelectItem key={key} value={key}>{conf.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Prefix เลขที่เอกสาร</Label>
                      <Input
                        value={localDocSettings?.ecDocPrefix || "EC"}
                        onChange={e => updateDocLocal("ecDocPrefix", e.target.value)}
                        placeholder="EC"
                        data-testid="input-ec-prefix"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">ตัวอย่าง: {localDocSettings?.ecDocPrefix || "EC"}-TIV-250402-0001</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">ข้อความหัวเอกสาร</Label>
                    <Textarea
                      value={localDocSettings?.ecReceiptHeaderText || ""}
                      onChange={e => updateDocLocal("ecReceiptHeaderText", e.target.value)}
                      rows={2} placeholder="ข้อความเพิ่มเติมด้านบนเอกสาร eCommerce"
                      data-testid="input-ec-header"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">ข้อความท้ายเอกสาร</Label>
                    <Textarea
                      value={localDocSettings?.ecReceiptFooterText || ""}
                      onChange={e => updateDocLocal("ecReceiptFooterText", e.target.value)}
                      rows={2} placeholder="เช่น ขอบคุณที่สั่งซื้อ ติดตามพัสดุที่..."
                      data-testid="input-ec-footer"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">แสดงโลโก้</p>
                      <p className="text-xs text-muted-foreground">แสดงโลโก้บริษัทบนเอกสาร</p>
                    </div>
                    <Switch
                      checked={localDocSettings?.ecReceiptShowLogo ?? true}
                      onCheckedChange={v => updateDocLocal("ecReceiptShowLogo", v)}
                      data-testid="switch-ec-show-logo"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">แสดงข้อมูลร้าน</p>
                      <p className="text-xs text-muted-foreground">ชื่อร้าน ที่อยู่ เลขผู้เสียภาษี</p>
                    </div>
                    <Switch
                      checked={localDocSettings?.ecReceiptShowCompanyInfo ?? true}
                      onCheckedChange={v => updateDocLocal("ecReceiptShowCompanyInfo", v)}
                      data-testid="switch-ec-show-company-info"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">แสดง QR ติดตามพัสดุ</p>
                      <p className="text-xs text-muted-foreground">QR Code สำหรับตรวจสอบสถานะพัสดุ</p>
                    </div>
                    <Switch
                      checked={localDocSettings?.ecReceiptShowQr ?? false}
                      onCheckedChange={v => updateDocLocal("ecReceiptShowQr", v)}
                      data-testid="switch-ec-show-qr"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Receipt className="h-4 w-4" style={{ color: "#03c9d7" }} />
                    ตัวอย่างเอกสาร
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">เปลี่ยนตามค่าที่ตั้งแบบเรียลไทม์</p>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-100 rounded-lg p-4 flex items-start justify-center min-h-[500px] overflow-auto">
                    {localDocSettings && (
                      <EcDocPreview settings={localDocSettings} company={company} />
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="accounting" className="space-y-4">
            <Card className="rounded-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-4 w-4" style={{ color: "#03c9d7" }} />
                  โหมดการทำงาน
                </CardTitle>
                <p className="text-xs text-muted-foreground">เลือกรูปแบบการทำงานที่เหมาะกับธุรกิจของคุณ</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => toggleAccountingMode.mutate("document_only")}
                    className={`rounded-xl border-2 p-5 text-left transition-all ${currentMode === "document_only" ? "border-[#fec90f] bg-[#fec90f]/10 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"}`}
                    data-testid="button-mode-document-only"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${currentMode === "document_only" ? "border-[#fec90f]" : "border-gray-300"}`}>
                        {currentMode === "document_only" && <div className="w-2.5 h-2.5 rounded-full bg-[#fec90f]" />}
                      </div>
                      <span className={`text-sm font-bold ${currentMode === "document_only" ? "text-[#d4a90c]" : "text-gray-500"}`}>
                        ออกเอกสารอย่างเดียว
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground ml-7">
                      ออกใบกำกับภาษีจากออเดอร์ ไม่ต้องลงบัญชี เหมาะสำหรับร้านค้าที่มีนักบัญชีดูแลอยู่แล้ว
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleAccountingMode.mutate("full_accounting")}
                    className={`rounded-xl border-2 p-5 text-left transition-all ${currentMode === "full_accounting" ? "border-[#05b187] bg-[#05b187]/10 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"}`}
                    data-testid="button-mode-full-accounting"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${currentMode === "full_accounting" ? "border-[#05b187]" : "border-gray-300"}`}>
                        {currentMode === "full_accounting" && <div className="w-2.5 h-2.5 rounded-full bg-[#05b187]" />}
                      </div>
                      <span className={`text-sm font-bold ${currentMode === "full_accounting" ? "text-[#05b187]" : "text-gray-500"}`}>
                        ระบบบัญชีครบวงจร
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground ml-7">
                      ออกเอกสาร + ลงบัญชีอัตโนมัติ เอกสารจะแสดงทั้งในอีคอมเมิร์ซและฝั่งบัญชี
                    </p>
                  </button>
                </div>
                {toggleAccountingMode.isPending && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> กำลังบันทึก...
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="etax" className="space-y-4">
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="w-5 h-5 text-cyan-500" /> ตั้งค่า e-Tax Invoice
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">ตั้งค่าการส่งใบกำกับภาษีอิเล็กทรอนิกส์ทางอีเมลจาก eCommerce</p>
              </CardHeader>
              <CardContent className="space-y-5">
                {etaxLoading ? (
                  <div className="text-center py-6"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" /></div>
                ) : etaxForm ? (
                  <>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-cyan-500" />
                        <span className="text-sm font-medium">เปิดใช้งาน e-Tax Invoice</span>
                      </div>
                      <Switch
                        checked={etaxForm.etaxEnabled || false}
                        onCheckedChange={(v) => setEtaxForm((f: any) => ({ ...f, etaxEnabled: v }))}
                        data-testid="switch-etax-enabled"
                      />
                    </div>

                    {etaxForm.etaxEnabled && (
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium">ผู้ให้บริการอีเมล</Label>
                          <Select
                            value={etaxForm.etaxEmailProvider || "resend"}
                            onValueChange={(v) => setEtaxForm((f: any) => ({ ...f, etaxEmailProvider: v }))}
                          >
                            <SelectTrigger className="mt-1" data-testid="select-etax-provider">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="resend">Resend (ค่าเริ่มต้น)</SelectItem>
                              <SelectItem value="gmail">Gmail</SelectItem>
                              <SelectItem value="smtp">SMTP อื่นๆ</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {(etaxForm.etaxEmailProvider === "gmail" || etaxForm.etaxEmailProvider === "smtp") && (
                          <div className="space-y-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                            <p className="text-xs text-amber-700 font-medium">ตั้งค่า SMTP</p>
                            {etaxForm.etaxEmailProvider === "smtp" && (
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs">SMTP Host</Label>
                                  <Input
                                    value={etaxForm.smtpHost || ""}
                                    onChange={(e) => setEtaxForm((f: any) => ({ ...f, smtpHost: e.target.value }))}
                                    placeholder="smtp.example.com"
                                    data-testid="input-smtp-host"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">SMTP Port</Label>
                                  <Input
                                    type="number"
                                    value={etaxForm.smtpPort || 587}
                                    onChange={(e) => setEtaxForm((f: any) => ({ ...f, smtpPort: parseInt(e.target.value) || 587 }))}
                                    data-testid="input-smtp-port"
                                  />
                                </div>
                              </div>
                            )}
                            <div>
                              <Label className="text-xs">Email/Username</Label>
                              <Input
                                value={etaxForm.smtpUser || ""}
                                onChange={(e) => setEtaxForm((f: any) => ({ ...f, smtpUser: e.target.value }))}
                                placeholder="your@email.com"
                                data-testid="input-smtp-user"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Password / App Password</Label>
                              <Input
                                type="password"
                                value={etaxForm.smtpPass || ""}
                                onChange={(e) => setEtaxForm((f: any) => ({ ...f, smtpPass: e.target.value }))}
                                placeholder="••••••••"
                                data-testid="input-smtp-pass"
                              />
                            </div>
                          </div>
                        )}

                        <div>
                          <Label className="text-sm font-medium">อีเมล Timestamp (สพธอ.)</Label>
                          <Input
                            value={etaxForm.etaxTimestampEmail || "csemail@etax.teda.th"}
                            onChange={(e) => setEtaxForm((f: any) => ({ ...f, etaxTimestampEmail: e.target.value }))}
                            placeholder="csemail@etax.teda.th"
                            className="mt-1"
                            data-testid="input-etax-timestamp-email"
                          />
                          <p className="text-xs text-slate-400 mt-1">CC ทุกฉบับไปที่อีเมลนี้เพื่อประทับเวลาตามกฎหมาย</p>
                        </div>

                        <div>
                          <Label className="text-sm font-medium">อีเมลทดสอบ (ถ้ากรอก — ส่งไปอีเมลนี้แทนลูกค้าจริง)</Label>
                          <Input
                            value={etaxForm.etaxBuyerTestEmail || ""}
                            onChange={(e) => setEtaxForm((f: any) => ({ ...f, etaxBuyerTestEmail: e.target.value }))}
                            placeholder="test@company.com"
                            className="mt-1"
                            data-testid="input-etax-test-email"
                          />
                        </div>

                        <div>
                          <Label className="text-sm font-medium">เลขสาขาผู้ขาย</Label>
                          <Input
                            value={etaxForm.sellerBranchId || "00000"}
                            onChange={(e) => setEtaxForm((f: any) => ({ ...f, sellerBranchId: e.target.value }))}
                            placeholder="00000"
                            className="mt-1"
                            data-testid="input-etax-seller-branch"
                          />
                          <p className="text-xs text-slate-400 mt-1">00000 = สำนักงานใหญ่</p>
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={handleSaveEtax}
                      className="w-full bg-cyan-500 hover:bg-cyan-600"
                      disabled={etaxSaving}
                      data-testid="button-save-etax"
                    >
                      <Save className="w-4 h-4 mr-1" />
                      {etaxSaving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า e-Tax"}
                    </Button>
                  </>
                ) : (
                  <div className="text-center py-6 text-sm text-slate-500">ไม่สามารถโหลดการตั้งค่าได้</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </EcommerceLayout>
  );
}
