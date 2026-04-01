import { useState, useRef, useCallback } from "react";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import MobileLayout from "@/components/mobile-layout";
import { useCompany } from "@/lib/company-context";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Camera,
  Upload,
  X,
  Loader2,
  Check,
  RotateCcw,
  PenLine,
  Zap,
  Receipt,
  Calendar,
  Store,
  Hash,
  BadgeDollarSign,
} from "lucide-react";

interface OcrResult {
  date?: string;
  vendor?: string;
  description?: string;
  amount?: number;
  vat?: number;
  subtotal?: number;
  taxId?: string;
  receiptNumber?: string;
}

type Step = "capture" | "staged" | "processing" | "review" | "success";

export default function ExpenseSnap() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const { dateEra, dateFmt } = useDateSettings();
  const [, setLocation] = useLocation();
  const companyId = selectedCompany?.id;

  const [step, setStep] = useState<Step>("capture");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formData, setFormData] = useState<OcrResult>({});
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "ไฟล์ไม่ถูกต้อง", description: "กรุณาเลือกไฟล์รูปภาพ", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "ไฟล์ใหญ่เกินไป", description: "ขนาดไฟล์ไม่เกิน 10MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
      setStep("staged");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, [toast]);

  const handleCameraCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
      setStep("staged");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const goManualEntry = () => {
    setFormData({
      date: new Date().toISOString().split("T")[0],
      vendor: "",
      description: "",
      amount: 0,
      vat: 0,
      subtotal: 0,
      taxId: "",
      receiptNumber: "",
    });
    setStep("review");
  };

  const processWithAI = async () => {
    if (!imagePreview) return;
    setStep("processing");
    try {
      const res = await fetch("/api/expense-snap/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ image: imagePreview, companyId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "OCR ล้มเหลว");
      }
      const result: OcrResult = await res.json();
      setFormData({
        date: result.date || new Date().toISOString().split("T")[0],
        vendor: result.vendor || "",
        description: result.description || "",
        amount: result.amount || 0,
        vat: result.vat || 0,
        subtotal: result.subtotal || 0,
        taxId: result.taxId || "",
        receiptNumber: result.receiptNumber || "",
      });
      setStep("review");
    } catch (err: any) {
      toast({ title: "OCR ล้มเหลว", description: err.message, variant: "destructive" });
      setStep("staged");
    }
  };

  const handleSave = async () => {
    if (!companyId) {
      toast({ title: "กรุณาเลือกบริษัท", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/expense-snap/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...formData, companyId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "บันทึกล้มเหลว");
      }
      setStep("success");
      toast({ title: "บันทึกค่าใช้จ่ายสำเร็จ" });
    } catch (err: any) {
      toast({ title: "บันทึกล้มเหลว", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const resetAll = () => {
    setStep("capture");
    setImagePreview(null);
    setFormData({});
  };

  return (
    <MobileLayout title="Expense Snap" showBack>
      <div className="px-4 py-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
          data-testid="input-file-upload"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleCameraCapture}
          data-testid="input-camera-capture"
        />

        {step === "capture" && (
          <div className="space-y-4">
            <div className="text-center py-8">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#03c9d7]/20 to-[#fb9678]/20 flex items-center justify-center mx-auto mb-4">
                <Receipt className="h-10 w-10 text-[#03c9d7]" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200" data-testid="text-snap-title">
                บันทึกค่าใช้จ่าย
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                ถ่ายรูปใบเสร็จ หรือกรอกข้อมูลเอง
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center gap-3 p-6 bg-gradient-to-br from-[#03c9d7] to-[#03c9d7]/80 text-white rounded-2xl shadow-lg active:scale-[0.97] transition-all"
                data-testid="button-take-photo"
              >
                <Camera className="h-8 w-8" />
                <span className="text-sm font-bold">ถ่ายรูป</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-3 p-6 bg-gradient-to-br from-[#fb9678] to-[#fb9678]/80 text-white rounded-2xl shadow-lg active:scale-[0.97] transition-all"
                data-testid="button-upload-photo"
              >
                <Upload className="h-8 w-8" />
                <span className="text-sm font-bold">อัพโหลด</span>
              </button>
            </div>

            <button
              onClick={goManualEntry}
              className="w-full mt-2 py-3.5 text-sm font-medium border-2 border-[#05b187] text-[#05b187] flex items-center justify-center gap-2 rounded-2xl active:scale-[0.98] transition-all"
              data-testid="button-manual-entry"
            >
              <PenLine className="h-4 w-4" />
              กรอกเอง (ฟรี)
            </button>
          </div>
        )}

        {step === "staged" && (
          <div className="space-y-4">
            {imagePreview && (
              <div className="relative rounded-2xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700">
                <img src={imagePreview} alt="Receipt" className="w-full max-h-56 object-cover" data-testid="img-staged-preview" />
                <button
                  onClick={resetAll}
                  className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full backdrop-blur-sm"
                  data-testid="button-clear-staged"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
            )}

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
              <p className="text-xs text-amber-700 dark:text-amber-300 text-center">
                AI จะอ่านข้อมูลจากใบเสร็จ (มีค่าใช้จ่าย API) หรือกด "กรอกเอง" เพื่อคีย์ข้อมูลด้วยตนเอง
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={goManualEntry}
                className="py-3.5 rounded-2xl border-2 border-[#05b187] text-[#05b187] font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                data-testid="button-manual-free"
              >
                <PenLine className="h-4 w-4" />
                กรอกเอง (ฟรี)
              </button>
              <button
                onClick={processWithAI}
                className="py-3.5 rounded-2xl bg-purple-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg"
                data-testid="button-ai-ocr"
              >
                <Zap className="h-4 w-4" />
                AI อ่านให้
              </button>
            </div>
          </div>
        )}

        {step === "processing" && (
          <div className="text-center py-16 space-y-4">
            {imagePreview && (
              <div className="w-48 h-48 mx-auto rounded-2xl overflow-hidden shadow-lg mb-4">
                <img src={imagePreview} alt="Receipt" className="w-full h-full object-cover" data-testid="img-processing-preview" />
              </div>
            )}
            <Loader2 className="h-8 w-8 text-purple-600 animate-spin mx-auto" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400" data-testid="text-processing">
              AI กำลังอ่านใบเสร็จ...
            </p>
            <p className="text-xs text-gray-400">อาจใช้เวลา 5-10 วินาที</p>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            {imagePreview && (
              <div className="relative rounded-2xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700">
                <img src={imagePreview} alt="Receipt" className="w-full max-h-40 object-cover" data-testid="img-receipt-preview" />
              </div>
            )}

            <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 space-y-3">
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Receipt className="h-4 w-4 text-[#03c9d7]" />
                ข้อมูลค่าใช้จ่าย
              </h3>

              <div className="flex items-center gap-3">
                <div className="text-gray-400 dark:text-gray-500 flex-shrink-0"><Calendar className="h-4 w-4" /></div>
                <div className="flex-1">
                  <label className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-medium">วันที่</label>
                  <ThaiDateInput value={formData.date || ""} onChange={(v: string) => setFormData({ ...formData, date: v })} dateEra={dateEra} dateFmt={dateFmt} className="h-8 text-sm" data-testid="input-ocr-date" />
                </div>
              </div>
              <FormField
                icon={<Store className="h-4 w-4" />}
                label="ร้านค้า / ผู้ขาย"
                value={formData.vendor || ""}
                onChange={(v) => setFormData({ ...formData, vendor: v })}
                testId="input-ocr-vendor"
              />
              <FormField
                icon={<Hash className="h-4 w-4" />}
                label="เลขที่ใบเสร็จ"
                value={formData.receiptNumber || ""}
                onChange={(v) => setFormData({ ...formData, receiptNumber: v })}
                testId="input-ocr-receipt-number"
              />
              <FormField
                icon={<Receipt className="h-4 w-4" />}
                label="รายละเอียด"
                value={formData.description || ""}
                onChange={(v) => setFormData({ ...formData, description: v })}
                testId="input-ocr-description"
              />
              <FormField
                icon={<BadgeDollarSign className="h-4 w-4" />}
                label="ยอดก่อน VAT"
                value={String(formData.subtotal || 0)}
                onChange={(v) => setFormData({ ...formData, subtotal: parseFloat(v) || 0 })}
                type="number"
                testId="input-ocr-subtotal"
              />
              <FormField
                icon={<BadgeDollarSign className="h-4 w-4" />}
                label="VAT"
                value={String(formData.vat || 0)}
                onChange={(v) => setFormData({ ...formData, vat: parseFloat(v) || 0 })}
                type="number"
                testId="input-ocr-vat"
              />
              <FormField
                icon={<BadgeDollarSign className="h-4 w-4" />}
                label="ยอดรวมทั้งสิ้น"
                value={String(formData.amount || 0)}
                onChange={(v) => setFormData({ ...formData, amount: parseFloat(v) || 0 })}
                type="number"
                testId="input-ocr-amount"
              />
              <FormField
                icon={<Hash className="h-4 w-4" />}
                label="เลขประจำตัวผู้เสียภาษี"
                value={formData.taxId || ""}
                onChange={(v) => setFormData({ ...formData, taxId: v })}
                testId="input-ocr-tax-id"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={resetAll}
                className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                data-testid="button-retake"
              >
                <RotateCcw className="h-4 w-4" />
                เริ่มใหม่
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 rounded-2xl bg-[#03c9d7] text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                data-testid="button-save-expense"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {saving ? "กำลังบันทึก..." : "บันทึกค่าใช้จ่าย"}
              </button>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="text-center py-16 space-y-4">
            <div className="w-20 h-20 rounded-full bg-[#e8f8f0] flex items-center justify-center mx-auto">
              <Check className="h-10 w-10 text-[#05b187]" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200" data-testid="text-success">
              บันทึกสำเร็จ!
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              ค่าใช้จ่ายถูกบันทึกเรียบร้อยแล้ว
            </p>
            <div className="flex gap-3 pt-4">
              <button
                onClick={resetAll}
                className="flex-1 py-3 rounded-2xl bg-[#03c9d7] text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                data-testid="button-snap-another"
              >
                <Camera className="h-4 w-4" />
                บันทึกรายการใหม่
              </button>
              <button
                onClick={() => setLocation("/m/dashboard")}
                className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-medium text-sm active:scale-[0.98] transition-all"
                data-testid="button-back-to-dashboard"
              >
                กลับ Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}

function FormField({
  icon,
  label,
  value,
  onChange,
  type = "text",
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  testId: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-gray-400 dark:text-gray-500 flex-shrink-0">{icon}</div>
      <div className="flex-1">
        <label className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-medium">{label}</label>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent border-b border-gray-200 dark:border-gray-700 py-1 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:border-[#03c9d7] transition-colors"
          data-testid={testId}
        />
      </div>
    </div>
  );
}
