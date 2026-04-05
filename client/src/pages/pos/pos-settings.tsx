import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { objectPathToUrl } from "@/lib/utils";
import PosLayout from "@/components/pos-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import {
  Settings, CreditCard, Receipt, Store, Plus, Pencil, Trash2, Save,
  Banknote, QrCode, Smartphone, Wallet, FileImage, Upload, X, Loader2, FileText, Printer, TestTube,
  Mail, Shield
} from "lucide-react";
import { printTestPage } from "@/lib/thermal-printer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PM_ICONS: Record<string, any> = {
  cash: Banknote, credit_card: CreditCard, promptpay: QrCode, transfer: Smartphone, ewallet: Wallet,
};

const PM_TYPES = [
  { value: "cash", label: "เงินสด" },
  { value: "credit_card", label: "บัตรเครดิต" },
  { value: "promptpay", label: "พร้อมเพย์" },
  { value: "transfer", label: "โอนเงิน" },
  { value: "ewallet", label: "E-Wallet" },
];

interface DocSettings {
  id?: number;
  companyId: number;
  logoUrl?: string | null;
  posReceiptWidth: string;
  posReceiptShowLogo: boolean;
  posReceiptShowCompanyInfo: boolean;
  posReceiptShowQr: boolean;
  posReceiptHeaderText?: string | null;
  posReceiptFooterText?: string | null;
  posReceiptAutoPrint: boolean;
  posReceiptFontSize: string;
  posReceiptPrefix: string;
}

function ImageUploadBox({ label, currentUrl, onUploaded, onClear, testId }: {
  label: string; currentUrl?: string | null; onUploaded: (path: string) => void; onClear: () => void; testId: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { uploadFile, isUploading } = useUpload({
    onSuccess: (r) => { setUploadError(null); onUploaded(r.objectPath); },
    onError: (err) => setUploadError(err.message || "อัพโหลดไม่สำเร็จ"),
  });

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("ไฟล์ต้องมีขนาดไม่เกิน 5MB"); return; }
    setUploadError(null);
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
      {uploadError && (
        <p className="text-xs text-rose-500 mt-1" data-testid={`error-${testId}`}>{uploadError}</p>
      )}
    </div>
  );
}

const FONT_SIZES: Record<string, { body: string; heading: string; title: string; label: string }> = {
  small: { body: "10px", heading: "11px", title: "12px", label: "เล็ก (10px)" },
  medium: { body: "11px", heading: "12px", title: "13px", label: "กลาง (11px) — แนะนำ" },
  large: { body: "12px", heading: "13px", title: "14px", label: "ใหญ่ (12px)" },
  xlarge: { body: "14px", heading: "15px", title: "16px", label: "ใหญ่พิเศษ (14px)" },
};

function ReceiptPreview({ settings, company }: { settings: DocSettings; company: any }) {
  const is58 = settings.posReceiptWidth === "58mm";
  const width = is58 ? 240 : 320;
  const fontConf = FONT_SIZES[settings.posReceiptFontSize] || FONT_SIZES.medium;
  const fontSize = fontConf.body;

  return (
    <div
      className="bg-white mx-auto shadow-md"
      style={{
        width,
        fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif",
        fontSize,
        lineHeight: "1.5",
        borderRadius: "2px",
      }}
      data-testid="receipt-preview"
    >
      {settings.posReceiptShowLogo && settings.logoUrl && (
        <div className="pt-4 pb-2 text-center">
          <img src={objectPathToUrl(settings.logoUrl) || settings.logoUrl} alt="Logo" className="max-h-16 mx-auto object-contain" />
        </div>
      )}

      {settings.posReceiptShowCompanyInfo && company && (
        <div className="text-center px-4 pb-3" style={{ fontSize }}>
          <div className="font-bold mb-0.5" style={{ fontSize: fontConf.title }}>{company.name || "ชื่อร้าน"}</div>
          <div className="text-gray-500" style={{ fontSize }}>{(company as any).branch || "สำนักงานใหญ่"}</div>
          {company.address && <div className="text-gray-600 leading-snug">{company.address}</div>}
          {company.taxId && <div className="text-gray-500">เลขผู้เสียภาษี {company.taxId}</div>}
          {company.phone && <div className="text-gray-500">โทร {company.phone}</div>}
          {settings.posReceiptHeaderText && (
            <div className="text-gray-600 leading-snug whitespace-pre-line mt-1">{settings.posReceiptHeaderText}</div>
          )}
          <div className="font-bold mt-1" style={{ fontSize: fontConf.heading }}>ใบกำกับภาษีอย่างย่อ</div>
          <div className="text-gray-500" style={{ fontSize }}>ABB. TAX INVOICE</div>
        </div>
      )}

      <div className="border-t border-dashed border-gray-400 mx-2" />

      <div className="px-4 py-2" style={{ fontSize }}>
        <div className="text-gray-500 mb-0.5">พนักงาน: สมชาย</div>
        <div className="text-gray-500">ระบบขายหน้าร้าน: POS 1</div>
      </div>

      <div className="border-t border-dashed border-gray-400 mx-2" />

      <div className="px-4 py-3 space-y-2" style={{ fontSize }}>
        {[
          { name: "ปลอกหมอนจัมโบ้", qty: 1, price: 200 },
          { name: "ผ้าห่มนาโน", qty: 2, price: 350 },
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

      <div className="border-t border-dashed border-gray-400 mx-2" />

      <div className="px-4 py-3 space-y-1" style={{ fontSize }}>
        <div className="flex justify-between font-bold" style={{ fontSize: fontConf.heading }}>
          <span>รวมทั้งหมด</span>
          <span>฿900.00</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>ภาษีมูลค่าเพิ่ม, 7%</span>
          <span>฿58.88</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>โอนเข้าเครื่องรูด</span>
          <span>฿900.00</span>
        </div>
      </div>

      {settings.posReceiptShowQr && (
        <>
          <div className="border-t border-dashed border-gray-400 mx-2" />
          <div className="py-3 text-center">
            <div className="w-20 h-20 mx-auto border-2 border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center">
              <QrCode className="w-12 h-12 text-gray-300" />
            </div>
            <div className="text-xs text-gray-400 mt-1">PromptPay QR</div>
          </div>
        </>
      )}

      {settings.posReceiptFooterText && (
        <>
          <div className="border-t border-dashed border-gray-400 mx-2" />
          <div className="px-4 py-3 text-center text-gray-500 leading-snug whitespace-pre-line" style={{ fontSize }}>
            {settings.posReceiptFooterText}
          </div>
        </>
      )}

      <div className="border-t border-dashed border-gray-400 mx-2" />

      <div className="px-4 py-2 flex justify-between text-gray-400" style={{ fontSize: is58 ? "11px" : "12px" }}>
        <span>02/04/68 16:52 น.</span>
        <span>#{settings.posReceiptPrefix}-0001</span>
      </div>
    </div>
  );
}

export default function PosSettings() {
  const { selectedCompanyId, selectedCompany: company } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [pmDialogOpen, setPmDialogOpen] = useState(false);
  const [editPm, setEditPm] = useState<any>(null);
  const [deletePmId, setDeletePmId] = useState<number | null>(null);
  const [pmForm, setPmForm] = useState({ name: "", type: "cash", isActive: true });

  const { data: paymentMethods = [], isLoading: pmLoading } = useQuery({
    queryKey: ["/api/payment-methods", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/payment-methods?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["/api/pos/branches", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/pos/branches?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: docSettings } = useQuery<DocSettings>({
    queryKey: ["/api/document-settings", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/document-settings/${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return {
        companyId: selectedCompanyId!,
        posReceiptWidth: "80mm",
        posReceiptShowLogo: true,
        posReceiptShowCompanyInfo: true,
        posReceiptShowQr: true,
        posReceiptAutoPrint: false,
        posReceiptFontSize: "medium",
        posReceiptPrefix: "POS",
      };
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const [localDoc, setLocalDoc] = useState<DocSettings | null>(null);
  useEffect(() => { if (docSettings) setLocalDoc(docSettings); }, [docSettings]);

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

  const docMutation = useMutation({
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
      toast({ title: "บันทึกตั้งค่าเอกสารสำเร็จ" });
    },
    onError: () => toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" }),
  });

  const createPmMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/payment-methods", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ ...data, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message || "Error");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
      setPmDialogOpen(false);
      toast({ title: "เพิ่มช่องทางชำระเงินแล้ว" });
    },
    onError: (e: any) => toast({ title: "เกิดข้อผิดพลาด", description: e.message, variant: "destructive" }),
  });

  const updatePmMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await fetch(`/api/payment-methods/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ ...data, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message || "Error");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
      setPmDialogOpen(false);
      setEditPm(null);
      toast({ title: "อัปเดตแล้ว" });
    },
    onError: (e: any) => toast({ title: "เกิดข้อผิดพลาด", description: e.message, variant: "destructive" }),
  });

  const deletePmMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/payment-methods/${id}?companyId=${selectedCompanyId}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("Error");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
      setDeletePmId(null);
      toast({ title: "ลบแล้ว" });
    },
  });

  const openCreatePm = () => {
    setEditPm(null);
    setPmForm({ name: "", type: "cash", isActive: true });
    setPmDialogOpen(true);
  };

  const openEditPm = (pm: any) => {
    setEditPm(pm);
    setPmForm({ name: pm.name || "", type: pm.type || "cash", isActive: pm.isActive !== false });
    setPmDialogOpen(true);
  };

  const savePm = () => {
    if (!pmForm.name.trim()) return toast({ title: "กรุณากรอกชื่อ", variant: "destructive" });
    if (editPm) updatePmMutation.mutate({ id: editPm.id, data: pmForm });
    else createPmMutation.mutate(pmForm);
  };

  const updateDoc = (key: string, val: any) => setLocalDoc(prev => prev ? { ...prev, [key]: val } : prev);

  return (
    <PosLayout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2" data-testid="text-page-title">
            <Settings className="w-6 h-6 text-[#03c9d7]" /> ตั้งค่า POS
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">จัดการช่องทางชำระเงิน สาขา และตั้งค่าเอกสาร</p>
        </div>

        <Tabs defaultValue="general" className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full max-w-lg">
            <TabsTrigger value="general" data-testid="tab-general">ทั่วไป</TabsTrigger>
            <TabsTrigger value="receipt" data-testid="tab-receipt">ใบเสร็จ/เอกสาร</TabsTrigger>
            <TabsTrigger value="branches" data-testid="tab-branches">สาขา</TabsTrigger>
            <TabsTrigger value="etax" data-testid="tab-etax">e-Tax</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-[#03c9d7]" /> ช่องทางชำระเงิน
                  </CardTitle>
                  <Button size="sm" onClick={openCreatePm} className="bg-[#03c9d7] hover:bg-[#02b5c2] text-white" data-testid="button-add-payment">
                    <Plus className="w-4 h-4 mr-1" /> เพิ่มช่องทาง
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {pmLoading ? (
                  <div className="text-center py-8 text-slate-400">กำลังโหลด...</div>
                ) : paymentMethods.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <CreditCard className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p>ยังไม่มีช่องทางชำระเงิน</p>
                    <Button variant="outline" size="sm" className="mt-2" onClick={openCreatePm}>เพิ่มช่องทาง</Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ชื่อ</TableHead>
                        <TableHead>ประเภท</TableHead>
                        <TableHead>สถานะ</TableHead>
                        <TableHead className="text-right">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentMethods.map((pm: any) => {
                        const Icon = PM_ICONS[pm.type] || CreditCard;
                        return (
                          <TableRow key={pm.id} data-testid={`row-pm-${pm.id}`}>
                            <TableCell className="font-medium flex items-center gap-2">
                              <Icon className="w-4 h-4 text-slate-500" /> {pm.name}
                            </TableCell>
                            <TableCell className="text-sm">{PM_TYPES.find(t => t.value === pm.type)?.label || pm.type}</TableCell>
                            <TableCell>
                              {pm.isActive !== false
                                ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">เปิดใช้งาน</Badge>
                                : <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-xs">ปิดใช้งาน</Badge>
                              }
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openEditPm(pm)} data-testid={`button-edit-pm-${pm.id}`}>
                                  <Pencil className="w-4 h-4 text-slate-500" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setDeletePmId(pm.id)} data-testid={`button-delete-pm-${pm.id}`}>
                                  <Trash2 className="w-4 h-4 text-red-400" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-[#03c9d7]" /> การตั้งค่าใบเสร็จ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <div className="font-medium text-sm text-slate-800">ออกใบกำกับภาษีอัตโนมัติ</div>
                    <div className="text-xs text-slate-400">ออกใบกำกับภาษีทุกครั้งเมื่อปิดกะขาย</div>
                  </div>
                  <Switch defaultChecked data-testid="switch-auto-invoice" />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <div className="font-medium text-sm text-slate-800">แสดง QR PromptPay</div>
                    <div className="text-xs text-slate-400">แสดง QR Code พร้อมเพย์ในหน้าชำระเงิน</div>
                  </div>
                  <Switch defaultChecked data-testid="switch-promptpay-qr" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="receipt" className="space-y-4">
            <div className="flex justify-end">
              <Button
                onClick={() => localDoc && docMutation.mutate(localDoc)}
                disabled={docMutation.isPending}
                data-testid="button-save-doc"
              >
                {docMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                บันทึก
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Card className="border-none shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileImage className="w-5 h-5 text-[#fb9678]" /> โลโก้ร้านค้า
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">โลโก้จะแสดงด้านบนใบเสร็จอย่างย่อ</p>
                  </CardHeader>
                  <CardContent>
                    <ImageUploadBox
                      label="โลโก้ร้าน"
                      currentUrl={localDoc?.logoUrl}
                      onUploaded={(path) => updateDoc("logoUrl", path)}
                      onClear={() => updateDoc("logoUrl", null)}
                      testId="pos-logo"
                    />
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Printer className="w-5 h-5 text-[#03c9d7]" /> ขนาดกระดาษ & Prefix
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">ขนาดกระดาษใบเสร็จ</Label>
                      <Select
                        value={localDoc?.posReceiptWidth || "80mm"}
                        onValueChange={v => updateDoc("posReceiptWidth", v)}
                      >
                        <SelectTrigger data-testid="select-receipt-width"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="58mm">58mm (กระดาษเล็ก)</SelectItem>
                          <SelectItem value="80mm">80mm (มาตรฐาน)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">ขนาดตัวอักษร</Label>
                      <Select
                        value={localDoc?.posReceiptFontSize || "large"}
                        onValueChange={v => updateDoc("posReceiptFontSize", v)}
                      >
                        <SelectTrigger data-testid="select-font-size"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(FONT_SIZES).map(([key, conf]) => (
                            <SelectItem key={key} value={key}>{conf.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Prefix เลขที่ใบเสร็จ</Label>
                      <Input
                        value={localDoc?.posReceiptPrefix || "POS"}
                        onChange={e => updateDoc("posReceiptPrefix", e.target.value)}
                        placeholder="POS"
                        data-testid="input-receipt-prefix"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">ตัวอย่าง: {localDoc?.posReceiptPrefix || "POS"}-250402-0001</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="w-5 h-5 text-[#05b187]" /> ข้อความบนใบเสร็จ
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">ข้อความหัวบิล (ใต้ข้อมูลร้าน)</Label>
                      <Textarea
                        value={localDoc?.posReceiptHeaderText || ""}
                        onChange={e => updateDoc("posReceiptHeaderText", e.target.value)}
                        placeholder="เช่น สาขาสยามสแควร์ เปิดบริการ 10:00-22:00"
                        rows={2}
                        data-testid="input-receipt-header"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">ข้อความท้ายบิล</Label>
                      <Textarea
                        value={localDoc?.posReceiptFooterText || ""}
                        onChange={e => updateDoc("posReceiptFooterText", e.target.value)}
                        placeholder="เช่น ขอบคุณที่ใช้บริการ ❤️ ติดตาม @shopname"
                        rows={2}
                        data-testid="input-receipt-footer"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Settings className="w-5 h-5 text-[#539BFF]" /> ตัวเลือกแสดงผล
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <div className="font-medium text-sm">แสดงโลโก้</div>
                        <div className="text-xs text-muted-foreground">แสดงโลโก้ร้านค้าบนใบเสร็จ</div>
                      </div>
                      <Switch
                        checked={localDoc?.posReceiptShowLogo ?? true}
                        onCheckedChange={v => updateDoc("posReceiptShowLogo", v)}
                        data-testid="switch-show-logo"
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <div className="font-medium text-sm">แสดงข้อมูลร้าน</div>
                        <div className="text-xs text-muted-foreground">ชื่อร้าน ที่อยู่ เบอร์โทร เลขผู้เสียภาษี</div>
                      </div>
                      <Switch
                        checked={localDoc?.posReceiptShowCompanyInfo ?? true}
                        onCheckedChange={v => updateDoc("posReceiptShowCompanyInfo", v)}
                        data-testid="switch-show-company"
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <div className="font-medium text-sm">แสดง QR Code</div>
                        <div className="text-xs text-muted-foreground">แสดง PromptPay QR บนใบเสร็จ</div>
                      </div>
                      <Switch
                        checked={localDoc?.posReceiptShowQr ?? true}
                        onCheckedChange={v => updateDoc("posReceiptShowQr", v)}
                        data-testid="switch-show-qr"
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <div className="font-medium text-sm">พิมพ์อัตโนมัติ</div>
                        <div className="text-xs text-muted-foreground">พิมพ์ใบเสร็จทันทีหลังชำระเงินสำเร็จ</div>
                      </div>
                      <Switch
                        checked={localDoc?.posReceiptAutoPrint ?? false}
                        onCheckedChange={v => updateDoc("posReceiptAutoPrint", v)}
                        data-testid="switch-auto-print"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="border-none shadow-sm sticky top-4">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Receipt className="w-5 h-5 text-[#fec90f]" /> ตัวอย่างใบเสร็จ
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          ขนาด {localDoc?.posReceiptWidth || "80mm"}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-[#03c9d7] text-[#03c9d7] hover:bg-[#03c9d7]/10"
                        onClick={async () => {
                          try {
                            const pw = localDoc?.posReceiptWidth === "58mm" ? 58 : 80;
                            await printTestPage(pw as 58 | 80);
                            toast({ title: "ส่งเทสปริ้นท์แล้ว" });
                          } catch (err: any) {
                            toast({ title: "เทสปริ้นท์ไม่สำเร็จ", description: err.message, variant: "destructive" });
                          }
                        }}
                        data-testid="button-test-print"
                      >
                        <Printer className="h-4 w-4" />
                        เทสปริ้นท์
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="flex justify-center py-4 bg-gray-50 rounded-lg">
                    {localDoc && <ReceiptPreview settings={localDoc} company={company} />}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="branches" className="space-y-4">
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Store className="w-5 h-5 text-[#03c9d7]" /> สาขาที่เปิดใช้งาน
                </CardTitle>
              </CardHeader>
              <CardContent>
                {branches.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-sm">ยังไม่มีสาขา</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {branches.map((b: any) => (
                      <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border bg-white" data-testid={`card-branch-${b.id}`}>
                        <div>
                          <div className="font-medium text-slate-800">{b.name}</div>
                          <div className="text-xs text-slate-400">{b.code || ""} {b.address ? `• ${b.address}` : ""}</div>
                        </div>
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">เปิดใช้งาน</Badge>
                      </div>
                    ))}
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
                <p className="text-xs text-slate-500 mt-1">ตั้งค่าการส่งใบกำกับภาษีอิเล็กทรอนิกส์ทางอีเมลจาก POS</p>
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

      <Dialog open={pmDialogOpen} onOpenChange={setPmDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editPm ? "แก้ไขช่องทางชำระเงิน" : "เพิ่มช่องทางชำระเงิน"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ชื่อ</Label>
              <Input value={pmForm.name} onChange={e => setPmForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น เงินสด, บัตรเครดิต" data-testid="input-pm-name" />
            </div>
            <div>
              <Label>ประเภท</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {PM_TYPES.map(t => {
                  const Icon = PM_ICONS[t.value] || CreditCard;
                  return (
                    <button key={t.value} type="button"
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm transition-colors ${pmForm.type === t.value ? "border-[#03c9d7] bg-cyan-50 text-[#03c9d7] font-medium" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                      onClick={() => setPmForm(f => ({ ...f, type: t.value }))}
                      data-testid={`button-pm-type-${t.value}`}
                    >
                      <Icon className="w-4 h-4" /> {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={pmForm.isActive} onCheckedChange={v => setPmForm(f => ({ ...f, isActive: v }))} data-testid="switch-pm-active" />
              <Label>เปิดใช้งาน</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPmDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={savePm} className="bg-[#03c9d7] hover:bg-[#02b5c2] text-white" data-testid="button-save-pm">
              <Save className="w-4 h-4 mr-1" /> บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletePmId} onOpenChange={() => setDeletePmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบช่องทางชำระเงิน?</AlertDialogTitle>
            <AlertDialogDescription>การลบจะไม่สามารถย้อนกลับได้</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600" onClick={() => deletePmId && deletePmMutation.mutate(deletePmId)} data-testid="button-confirm-delete">ลบ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PosLayout>
  );
}
