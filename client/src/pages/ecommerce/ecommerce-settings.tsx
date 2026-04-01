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
  FileImage, Upload, X, Settings, Receipt, BookOpen, Truck
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import { useUpload } from "@/hooks/use-upload";
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
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="company" data-testid="tab-company">ข้อมูลบริษัท</TabsTrigger>
            <TabsTrigger value="document" data-testid="tab-document">เอกสาร</TabsTrigger>
            <TabsTrigger value="accounting" data-testid="tab-accounting">โหมดบัญชี</TabsTrigger>
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
        </Tabs>
      </div>
    </EcommerceLayout>
  );
}
