import Layout from "@/components/layout";
import { objectPathToUrl } from "@/lib/utils";
import SettingsTabs from "@/components/settings-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileImage, Save, Upload, X, Eye, Loader2, Palette, CreditCard, ArrowRight, ArrowLeft, Hash, Calendar, Globe, Plus, Star } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import { useUpload } from "@/hooks/use-upload";
import DocumentPreview from "@/components/document-preview";
import {
  DOCUMENT_TYPES_FULL,
  DOCUMENT_CATEGORIES,
  ALL_COLORS,
  DEFAULT_CATEGORY_COLORS,
  DOC_NUMBER_FORMATS,
  getDocumentType,
  getNextDocumentTypes,
  getDocTypeColor,
  getCategoryShades,
  getCategoryColor,
  parseCategoryColors,
  formatDocNumber,
  resolvePrefix,
  parseDocPrefixes,
  type DocPrefixConfig,
  type DocumentCategory,
  type DocNumberFormat,
  type DateEra,
  type ColorThemeKey,
} from "@shared/document-types";
import { LANGUAGES, type SupportedLanguage } from "@shared/i18n";

interface DocSettings {
  id?: number;
  companyId: number;
  logoUrl?: string | null;
  showLogo: boolean;
  showSignature: boolean;
  showTaxId: boolean;
  showBranch: boolean;
  showProductCode: boolean;
  headerNote?: string | null;
  headerNoteEn?: string | null;
  headerNoteZh?: string | null;
  footerNote?: string | null;
  footerNoteEn?: string | null;
  footerNoteZh?: string | null;
  paperSize: string;
  docFontSize?: string;
  showQrOnDoc?: boolean;
  bankAccountName?: string | null;
  bankAccountNameEn?: string | null;
  bankAccountNameZh?: string | null;
  bankAccountNumber?: string | null;
  bankName?: string | null;
  bankNameEn?: string | null;
  bankNameZh?: string | null;
  qrCodeUrl?: string | null;
  promptpayId?: string | null;
  promptpayType?: string | null;
  promptpayEnabled?: boolean;
  docTypeColors?: string | null;
  colorMode?: string;
  docNumberFormat?: string;
  docNumberDigits?: number;
  dateEra?: string;
  dateFormat?: string;
  documentLanguage?: string;
  docPrefixes?: string | null;
}

function LanguageFieldGroup({
  label,
  fieldBase,
  currentSettings,
  updateLocal,
  placeholder,
  testId,
  multiline,
}: {
  label: string;
  fieldBase: string;
  currentSettings: DocSettings;
  updateLocal: (key: string, value: any) => void;
  placeholder?: { th?: string; en?: string; zh?: string };
  testId: string;
  multiline?: boolean;
}) {
  const fields: { lang: SupportedLanguage; suffix: string; flag: string; ph?: string }[] = [
    { lang: "th", suffix: "", flag: "🇹🇭", ph: placeholder?.th },
    { lang: "en", suffix: "En", flag: "🇬🇧", ph: placeholder?.en },
    { lang: "zh", suffix: "Zh", flag: "🇨🇳", ph: placeholder?.zh },
  ];
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <div className="space-y-1">
        {fields.map(f => {
          const key = `${fieldBase}${f.suffix}` as keyof DocSettings;
          return (
            <div key={f.lang} className="flex items-center gap-1.5">
              <span className="text-sm w-6 flex-shrink-0 text-center">{f.flag}</span>
              {multiline ? (
                <Textarea
                  data-testid={`${testId}-${f.lang}`}
                  value={(currentSettings[key] as string) || ""}
                  onChange={(e: any) => updateLocal(key, e.target.value)}
                  placeholder={f.ph || ""}
                  rows={2}
                  className="flex-1 text-sm resize-none"
                />
              ) : (
                <Input
                  data-testid={`${testId}-${f.lang}`}
                  value={(currentSettings[key] as string) || ""}
                  onChange={(e: any) => updateLocal(key, e.target.value)}
                  placeholder={f.ph || ""}
                  className="flex-1 h-8 text-sm"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ImageUploadBox({
  label,
  currentUrl,
  onUploaded,
  onClear,
  accept,
  testId,
}: {
  label: string;
  currentUrl?: string | null;
  onUploaded: (objectPath: string) => void;
  onClear: () => void;
  accept: string;
  testId: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [imgError, setImgError] = useState(false);
  useEffect(() => { setImgError(false); }, [currentUrl]);
  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      setImgError(false);
      onUploaded(response.objectPath);
    },
  });

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("ไฟล์ต้องมีขนาดไม่เกิน 5MB");
      return;
    }
    await uploadFile(file);
    if (fileRef.current) fileRef.current.value = "";
  }, [uploadFile]);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {currentUrl ? (
        <div className="relative border rounded-lg p-3 bg-muted/30">
          {imgError ? (
            <div className="flex flex-col items-center gap-2 py-3 text-muted-foreground">
              <Upload className="h-6 w-6 opacity-50" />
              <span className="text-xs">ไม่สามารถโหลดรูปได้ กรุณาอัปโหลดใหม่</span>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>อัปโหลดใหม่</Button>
            </div>
          ) : (
            <img
              src={objectPathToUrl(currentUrl) || currentUrl}
              alt={label}
              className="max-h-24 max-w-full object-contain mx-auto"
              data-testid={`img-${testId}`}
              onError={() => setImgError(true)}
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-1 right-1 h-6 w-6 p-0 text-muted-foreground hover:text-rose-500"
            onClick={onClear}
            data-testid={`button-clear-${testId}`}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div
          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-[#03c9d7] hover:bg-[#e5f9fa]/50 dark:hover:bg-[#03c9d7]/15 transition-colors"
          onClick={() => fileRef.current?.click()}
          data-testid={`dropzone-${testId}`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#03c9d7" }} />
              <span className="text-xs text-muted-foreground">กำลังอัปโหลด...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground/50" />
              <span className="text-xs text-muted-foreground">คลิกเพื่ออัปโหลด</span>
              <span className="text-[10px] text-muted-foreground/50">PNG, JPG ไม่เกิน 5MB</span>
            </div>
          )}
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
        data-testid={`input-file-${testId}`}
      />
    </div>
  );
}

function CategoryColorPicker({
  categoryColors,
  onChangeCategoryColor,
  selectedDocType,
  onSelectDocType,
}: {
  categoryColors: Record<string, string>;
  onChangeCategoryColor: (category: string, colorKey: string) => void;
  selectedDocType: string;
  onSelectDocType: (key: string) => void;
}) {
  const categories = Object.entries(DOCUMENT_CATEGORIES) as [DocumentCategory, typeof DOCUMENT_CATEGORIES[DocumentCategory]][];
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const paletteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editingCategory) return;
    const handleClick = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        setEditingCategory(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [editingCategory]);

  return (
    <div className="space-y-5">
      {categories.map(([catKey, cat]) => {
        const docs = DOCUMENT_TYPES_FULL.filter(d => d.category === catKey);
        if (docs.length === 0) return null;
        const baseColorKey = getCategoryColor(catKey as DocumentCategory, categoryColors);
        const baseColor = ALL_COLORS.find(c => c.key === baseColorKey) || ALL_COLORS[0];
        const shades = getCategoryShades(baseColorKey, docs.length);
        const isEditing = editingCategory === catKey;

        return (
          <div key={catKey}>
            <div className="flex items-center gap-2 mb-2">
              <button
                className="w-6 h-6 rounded-full border-2 flex-shrink-0 hover:scale-110 transition-transform shadow-sm"
                style={{ backgroundColor: baseColor.primary, borderColor: baseColor.accent }}
                onClick={() => setEditingCategory(isEditing ? null : catKey)}
                title={`เปลี่ยนสีหมวด${cat.label}`}
                data-testid={`button-category-color-${catKey}`}
              />
              <span className="text-xs font-semibold text-muted-foreground">{cat.label}</span>
              <span className="text-[10px] text-muted-foreground/60">— โทน{baseColor.label}</span>
            </div>

            {isEditing && (
              <div ref={paletteRef} className="ml-2 mb-3 p-2.5 bg-muted/30 rounded-lg border relative">
                <button
                  className="absolute top-1 right-1 p-0.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setEditingCategory(null)}
                  data-testid={`button-close-palette-${catKey}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="grid grid-cols-7 gap-1.5">
                  {ALL_COLORS.map(c => (
                    <button
                      key={c.key}
                      onClick={() => { onChangeCategoryColor(catKey, c.key); setEditingCategory(null); }}
                      className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
                        baseColorKey === c.key ? "ring-2 ring-offset-1 scale-110" : ""
                      }`}
                      style={{
                        backgroundColor: c.primary,
                        borderColor: baseColorKey === c.key ? c.accent : c.light,
                        ...(baseColorKey === c.key ? { "--tw-ring-color": c.primary } as React.CSSProperties : {}),
                      }}
                      title={c.label}
                      data-testid={`button-pick-category-${catKey}-${c.key}`}
                    />
                  ))}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1.5 text-center">
                  เลือกโทนสีสำหรับ{cat.label}
                </div>
              </div>
            )}

            <div className="space-y-1 ml-1">
              {docs.map((doc, idx) => {
                const shade = shades[idx];
                const isSelected = doc.key === selectedDocType;
                return (
                  <div
                    key={doc.key}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                      isSelected ? "ring-1 ring-offset-1 shadow-sm" : "hover:bg-muted/30"
                    }`}
                    style={{
                      borderColor: isSelected ? shade.primary : undefined,
                      backgroundColor: isSelected ? shade.bg : undefined,
                      ...(isSelected ? { "--tw-ring-color": shade.primary } as React.CSSProperties : {}),
                    }}
                    onClick={() => onSelectDocType(doc.key)}
                    data-testid={`button-doctype-${doc.key}`}
                  >
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0 border"
                      style={{ backgroundColor: shade.primary, borderColor: shade.accent }}
                    />
                    <span className="font-medium flex-1 truncate" style={{ color: isSelected ? shade.primary : undefined }}>
                      {doc.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{doc.prefix}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const PREFIX_DOC_KEYS = ["quotation","sales_order","invoice","tax_invoice","receipt","billing_note","credit_note","debit_note","deposit","purchase_request","purchase_order","purchase_invoice","expense","payment_voucher","withholding_tax"] as const;

function PrefixEditor({ currentSettings, updateLocal }: { currentSettings: DocSettings; updateLocal: (field: string, value: any) => void }) {
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [newVal, setNewVal] = useState("");

  const allConfigs = parseDocPrefixes(currentSettings.docPrefixes);

  const saveConfig = (docKey: string, newOptions: string[], newDefault: string, builtinPrefix: string) => {
    const existing = parseDocPrefixes(currentSettings.docPrefixes);
    if (newOptions.length === 0) {
      delete existing[docKey];
    } else {
      existing[docKey] = { options: newOptions, default: newDefault };
    }
    const hasData = Object.keys(existing).length > 0;
    updateLocal("docPrefixes", hasData ? JSON.stringify(existing) : null);
  };

  return (
    <div className="space-y-3">
      {DOCUMENT_TYPES_FULL.filter(d => (PREFIX_DOC_KEYS as readonly string[]).includes(d.key)).map(doc => {
        const cfg = allConfigs[doc.key];
        const options = cfg?.options || [];
        const defaultPrefix = cfg?.default || doc.prefix;

        return (
          <div key={doc.key} className="border rounded-md p-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium">{doc.label}</span>
              <span className="text-[10px] text-muted-foreground font-mono">ค่าเดิม: {doc.prefix}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {options.map(opt => (
                <div key={opt} className={`flex items-center gap-0.5 border rounded px-1.5 py-0.5 text-xs font-mono ${opt === defaultPrefix ? "border-[#fb9678] bg-[#fb9678]/10 dark:bg-[#fb9678]/20" : "border-slate-200 dark:border-slate-600"}`}>
                  <button
                    type="button"
                    data-testid={`star-prefix-${doc.key}-${opt}`}
                    onClick={() => saveConfig(doc.key, options, opt, doc.prefix)}
                    className="p-0"
                    title="ตั้งเป็นค่าเริ่มต้น"
                  >
                    <Star className={`h-3 w-3 ${opt === defaultPrefix ? "fill-[#fb9678] text-[#fb9678]" : "text-slate-300 dark:text-slate-500"}`} />
                  </button>
                  <span>{opt}</span>
                  <button
                    type="button"
                    data-testid={`remove-prefix-${doc.key}-${opt}`}
                    onClick={() => {
                      const remaining = options.filter(o => o !== opt);
                      const newDef = opt === defaultPrefix ? (remaining[0] || doc.prefix) : defaultPrefix;
                      saveConfig(doc.key, remaining, newDef, doc.prefix);
                    }}
                    className="p-0 ml-0.5"
                  >
                    <X className="h-3 w-3 text-slate-400 dark:text-slate-500 hover:text-red-500" />
                  </button>
                </div>
              ))}
              {addingKey === doc.key ? (
                <div className="flex items-center gap-1">
                  <Input
                    className="h-6 text-xs w-14 uppercase text-center font-mono"
                    value={newVal}
                    maxLength={8}
                    autoFocus
                    data-testid={`input-add-prefix-${doc.key}`}
                    placeholder={doc.prefix}
                    onChange={e => setNewVal(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                    onKeyDown={e => {
                      if (e.key === "Enter" && newVal && !options.includes(newVal)) {
                        const newOpts = [...options, newVal];
                        saveConfig(doc.key, newOpts, options.length === 0 ? newVal : defaultPrefix, doc.prefix);
                        setNewVal("");
                        setAddingKey(null);
                      }
                      if (e.key === "Escape") { setNewVal(""); setAddingKey(null); }
                    }}
                  />
                  <button
                    type="button"
                    className="text-xs text-[#05b187] font-medium"
                    onClick={() => {
                      if (newVal && !options.includes(newVal)) {
                        const newOpts = [...options, newVal];
                        saveConfig(doc.key, newOpts, options.length === 0 ? newVal : defaultPrefix, doc.prefix);
                        setNewVal("");
                        setAddingKey(null);
                      }
                    }}
                  >ตกลง</button>
                  <button
                    type="button"
                    className="text-xs text-slate-400 dark:text-slate-500"
                    onClick={() => { setNewVal(""); setAddingKey(null); }}
                  >ยกเลิก</button>
                </div>
              ) : (
                <button
                  type="button"
                  data-testid={`add-prefix-${doc.key}`}
                  onClick={() => { setAddingKey(doc.key); setNewVal(""); }}
                  className="flex items-center gap-0.5 border border-dashed border-slate-300 dark:border-slate-600 rounded px-1.5 py-0.5 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500"
                >
                  <Plus className="h-3 w-3" /> เพิ่ม
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DocumentTemplates() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const [activeTab, setActiveTab] = useState("general");
  const [previewDocType, setPreviewDocType] = useState("quotation");
  const [docHistory, setDocHistory] = useState<string[]>([]);

  const navigateToDoc = (key: string) => {
    setDocHistory(prev => [...prev, previewDocType]);
    setPreviewDocType(key);
  };

  const navigateBack = () => {
    if (docHistory.length === 0) return;
    const prev = docHistory[docHistory.length - 1];
    setDocHistory(h => h.slice(0, -1));
    setPreviewDocType(prev);
  };

  const { data: settings } = useQuery<DocSettings>({
    queryKey: ["/api/document-settings", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return null;
      const r = await fetch(`/api/document-settings/${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: userSignature } = useQuery({
    queryKey: ["/api/auth/me/signature"],
    queryFn: async () => {
      const r = await fetch("/api/auth/me/signature", { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
  });

  const [localSettings, setLocalSettings] = useState<DocSettings | null>(null);

  useEffect(() => {
    setLocalSettings(null);
  }, [selectedCompanyId]);

  const currentSettings: DocSettings = localSettings || settings || {
    companyId: selectedCompanyId || 0,
    showLogo: true,
    showSignature: true,
    showTaxId: true,
    showBranch: true,
    showProductCode: true,
    paperSize: "A4",
    docFontSize: "medium",
    showQrOnDoc: true,
    docTypeColors: null,
    colorMode: "color",
    docNumberFormat: "YMD_SEQ",
    docNumberDigits: 4,
    dateEra: "CE",
    dateFormat: "DD/MM/YYYY",
    documentLanguage: "th",
  };

  const updateLocal = (key: string, value: any) => {
    setLocalSettings(prev => ({
      ...(prev || currentSettings),
      [key]: value,
    }));
  };

  const hasChanges = localSettings !== null;

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<DocSettings>) => {
      if (!selectedCompanyId) throw new Error("กรุณาเลือกบริษัท");
      const r = await fetch(`/api/document-settings/${selectedCompanyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-settings"] });
      setLocalSettings(null);
      toast({ title: "บันทึกตั้งค่าเอกสารสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      logoUrl: currentSettings.logoUrl,
      showLogo: currentSettings.showLogo,
      showSignature: currentSettings.showSignature,
      showTaxId: currentSettings.showTaxId,
      showBranch: currentSettings.showBranch,
      showProductCode: currentSettings.showProductCode,
      headerNote: currentSettings.headerNote,
      headerNoteEn: currentSettings.headerNoteEn,
      headerNoteZh: currentSettings.headerNoteZh,
      footerNote: currentSettings.footerNote,
      footerNoteEn: currentSettings.footerNoteEn,
      footerNoteZh: currentSettings.footerNoteZh,
      paperSize: currentSettings.paperSize,
      docFontSize: currentSettings.docFontSize,
      showQrOnDoc: currentSettings.showQrOnDoc,
      bankAccountName: currentSettings.bankAccountName,
      bankAccountNameEn: currentSettings.bankAccountNameEn,
      bankAccountNameZh: currentSettings.bankAccountNameZh,
      bankAccountNumber: currentSettings.bankAccountNumber,
      bankName: currentSettings.bankName,
      bankNameEn: currentSettings.bankNameEn,
      bankNameZh: currentSettings.bankNameZh,
      qrCodeUrl: currentSettings.qrCodeUrl,
      promptpayId: currentSettings.promptpayId,
      promptpayType: currentSettings.promptpayType,
      promptpayEnabled: currentSettings.promptpayEnabled,
      docTypeColors: currentSettings.docTypeColors,
      colorMode: currentSettings.colorMode,
      docNumberFormat: currentSettings.docNumberFormat,
      docNumberDigits: currentSettings.docNumberDigits,
      dateEra: currentSettings.dateEra,
      dateFormat: currentSettings.dateFormat,
      documentLanguage: currentSettings.documentLanguage,
      docPrefixes: currentSettings.docPrefixes,
      certSignerName: currentSettings.certSignerName,
      certSignerPosition: currentSettings.certSignerPosition,
    });
  };

  const autoSaveImageMutation = useMutation({
    mutationFn: async (data: Partial<DocSettings>) => {
      if (!selectedCompanyId) throw new Error("กรุณาเลือกบริษัท");
      const r = await fetch(`/api/document-settings/${selectedCompanyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-settings"] });
      toast({ title: "บันทึกสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: "บันทึกไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const autoSaveField = useCallback((key: string, value: string | null) => {
    if (!selectedCompanyId) return;
    autoSaveImageMutation.mutate({ [key]: value });
  }, [selectedCompanyId, autoSaveImageMutation]);

  const categoryColorsMap = parseCategoryColors(currentSettings.docTypeColors);

  const updateCategoryColor = (category: string, colorKey: string) => {
    const current = { ...categoryColorsMap };
    current[category] = colorKey;
    updateLocal("docTypeColors", JSON.stringify(current));
  };

  const selectedDocInfo = getDocumentType(previewDocType);
  const nextDocs = getNextDocumentTypes(previewDocType);
  const selectedTheme = selectedDocInfo
    ? getDocTypeColor(previewDocType, categoryColorsMap, currentSettings.colorMode)
    : null;

  const refDoc = previewDocType !== "quotation" && previewDocType !== "purchase_request"
    ? {
        type: "ใบเสนอราคา",
        number: formatDocNumber(
          "QO", 1,
          (currentSettings.docNumberFormat as DocNumberFormat) || "YMD_SEQ",
          currentSettings.docNumberDigits || 4,
          (currentSettings.dateEra as DateEra) || "CE"
        )
      }
    : null;

  if (!selectedCompanyId) {
    return (
      <Layout>
        <SettingsTabs />
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <FileImage className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-semibold text-muted-foreground" data-testid="text-no-company">กรุณาเลือกบริษัท</h2>
          <p className="text-sm text-muted-foreground/70 mt-1">เลือกบริษัทจากเมนูด้านบนเพื่อตั้งค่าบริษัท</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SettingsTabs />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg text-white" style={{ background: "#03c9d7" }}>
              <FileImage className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-doc-settings-title">ตั้งค่าบริษัท</h1>
              <p className="text-sm text-muted-foreground mt-0.5">ตั้งค่าโทนสี เลขที่เอกสาร รูปแบบวันที่ และข้อมูลชำระเงิน</p>
            </div>
          </div>
          <Button
            className="text-white hover:opacity-90"
            style={{ background: "#03c9d7" }}
            onClick={handleSave}
            disabled={saveMutation.isPending || !hasChanges}
            data-testid="button-save-settings"
          >
            {saveMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> กำลังบันทึก...</>
            ) : (
              <><Save className="h-4 w-4 mr-2" /> บันทึกการตั้งค่า</>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-2 space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full grid grid-cols-5">
                <TabsTrigger value="general" className="text-xs" data-testid="tab-general">ทั่วไป</TabsTrigger>
                <TabsTrigger value="colors" className="text-xs" data-testid="tab-colors">โทนสี</TabsTrigger>
                <TabsTrigger value="numbering" className="text-xs" data-testid="tab-numbering">เลขที่</TabsTrigger>
                <TabsTrigger value="images" className="text-xs" data-testid="tab-images">โลโก้</TabsTrigger>
                <TabsTrigger value="display" className="text-xs" data-testid="tab-display">แสดงผล</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Globe className="h-4 w-4" /> ภาษาเอกสาร
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-2">
                      ภาษาที่ใช้แสดงบนเอกสาร — กรอกข้อมูลแต่ละภาษาไว้ล่วงหน้า เมื่อสลับภาษาระบบจะดึงข้อมูลที่เตรียมไว้ทันที
                    </p>
                    <div className="flex gap-2">
                      {LANGUAGES.map(lang => {
                        const isSelected = (currentSettings.documentLanguage || "th") === lang.key;
                        return (
                          <button
                            key={lang.key}
                            onClick={() => updateLocal("documentLanguage", lang.key)}
                            className={`flex-1 rounded-lg border-2 p-2.5 text-center transition-all ${
                              isSelected ? "border-[#03c9d7] bg-[#e5f9fa] dark:bg-[#03c9d7]/15" : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                            }`}
                            data-testid={`button-lang-${lang.key}`}
                          >
                            <div className="text-lg">{lang.flag}</div>
                            <div className={`text-xs font-medium mt-0.5`} style={isSelected ? { color: "#03c9d7" } : undefined}>
                              {lang.label}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">ข้อความบนเอกสาร</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <LanguageFieldGroup
                      label="หมายเหตุส่วนหัว"
                      fieldBase="headerNote"
                      currentSettings={currentSettings}
                      updateLocal={updateLocal}
                      placeholder={{ th: "เช่น เอกสารนี้ออกโดยระบบอัตโนมัติ", en: "e.g. Auto-generated document", zh: "例如：本文件由系统自动生成" }}
                      testId="input-header-note"
                      multiline
                    />
                    <LanguageFieldGroup
                      label="หมายเหตุท้ายเอกสาร"
                      fieldBase="footerNote"
                      currentSettings={currentSettings}
                      updateLocal={updateLocal}
                      placeholder={{ th: "เช่น เงื่อนไขการชำระเงิน", en: "e.g. Payment terms & conditions", zh: "例如：付款条件" }}
                      testId="input-footer-note"
                      multiline
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CreditCard className="h-4 w-4" /> ข้อมูลชำระเงิน
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <LanguageFieldGroup
                      label="ชื่อธนาคาร"
                      fieldBase="bankName"
                      currentSettings={currentSettings}
                      updateLocal={updateLocal}
                      placeholder={{ th: "เช่น ธ.กสิกรไทย", en: "e.g. Kasikorn Bank", zh: "例如：开泰银行" }}
                      testId="input-bank-name"
                    />
                    <div>
                      <Label>เลขที่บัญชี</Label>
                      <Input
                        data-testid="input-bank-account"
                        value={currentSettings.bankAccountNumber || ""}
                        onChange={e => updateLocal("bankAccountNumber", e.target.value)}
                        placeholder="เช่น 1234567890"
                        className="mt-1"
                      />
                    </div>
                    <LanguageFieldGroup
                      label="ชื่อบัญชี"
                      fieldBase="bankAccountName"
                      currentSettings={currentSettings}
                      updateLocal={updateLocal}
                      placeholder={{ th: "เช่น บริษัท ตัวอย่าง จำกัด", en: "e.g. Example Co., Ltd.", zh: "例如：示例有限公司" }}
                      testId="input-bank-account-name"
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="colors" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Palette className="h-4 w-4" /> โหมดสีเอกสาร
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-3">
                      เลือกโหมดสีสำหรับเอกสารที่พิมพ์ โหมดขาวดำช่วยประหยัดหมึกปริ้นท์
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => updateLocal("colorMode", "color")}
                        className={`relative rounded-lg border-2 p-3 transition-all ${
                          currentSettings.colorMode !== "mono"
                            ? "border-[#03c9d7] ring-2 ring-[#03c9d7]/30 bg-[#e5f9fa]/50 dark:bg-[#03c9d7]/15"
                            : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                        }`}
                        data-testid="btn-color-mode-color"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-3 w-12 rounded-full" style={{ background: "linear-gradient(90deg, #2563eb, #059669, #d97706, #7c3aed)" }} />
                          <span className="text-xs font-medium">สี (Color)</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground text-left">แสดงสีตามหมวดเอกสาร สวยงามเป็นทางการ</p>
                        {currentSettings.colorMode !== "mono" && (
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "#03c9d7" }}>
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          </div>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateLocal("colorMode", "mono")}
                        className={`relative rounded-lg border-2 p-3 transition-all ${
                          currentSettings.colorMode === "mono"
                            ? "border-gray-800 dark:border-gray-400 ring-2 ring-gray-300 dark:ring-gray-500 bg-gray-50 dark:bg-gray-700/50"
                            : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                        }`}
                        data-testid="btn-color-mode-mono"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-3 w-12 rounded-full" style={{ background: "linear-gradient(90deg, #374151, #6b7280, #9ca3af, #d1d5db)" }} />
                          <span className="text-xs font-medium">ขาวดำ (B&W)</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground text-left">ประหยัดหมึก เหมาะสำหรับพิมพ์ขาวดำ</p>
                        {currentSettings.colorMode === "mono" && (
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-gray-800 dark:bg-gray-400 flex items-center justify-center">
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          </div>
                        )}
                      </button>
                    </div>
                  </CardContent>
                </Card>

                {currentSettings.colorMode !== "mono" && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Palette className="h-4 w-4" /> โทนสีหมวดเอกสาร
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground mb-3">
                        กดวงกลมสีของหมวดเพื่อเปลี่ยนโทนสี ระบบจะกระจายเฉดสีให้แต่ละเอกสารอัตโนมัติ กดชื่อเอกสารเพื่อดูตัวอย่าง
                      </p>
                      <CategoryColorPicker
                        categoryColors={categoryColorsMap}
                        onChangeCategoryColor={updateCategoryColor}
                        selectedDocType={previewDocType}
                        onSelectDocType={setPreviewDocType}
                      />
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="numbering" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Hash className="h-4 w-4" /> รูปแบบเลขที่เอกสาร
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      กำหนดรูปแบบเลขที่เอกสาร ไม่มีเครื่องหมาย (-) เพื่อให้ง่ายต่อการคีย์ข้อมูล
                    </p>

                    <div>
                      <Label>รูปแบบ</Label>
                      <Select
                        value={currentSettings.docNumberFormat || "YMD_SEQ"}
                        onValueChange={v => updateLocal("docNumberFormat", v)}
                      >
                        <SelectTrigger className="mt-1" data-testid="select-number-format">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DOC_NUMBER_FORMATS.map(f => (
                            <SelectItem key={f.key} value={f.key}>
                              <div className="flex items-center justify-between gap-3 w-full">
                                <span>{f.label}</span>
                                <span className="text-xs text-muted-foreground">{f.example}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>จำนวนหลักลำดับ</Label>
                      <p className="text-[11px] text-muted-foreground mb-1.5">
                        ธุรกิจออนไลน์ที่มีเอกสารจำนวนมากแนะนำ 5-6 หลัก (รองรับ 99,999 - 999,999 รายการ)
                      </p>
                      <Select
                        value={String(currentSettings.docNumberDigits || 4)}
                        onValueChange={v => updateLocal("docNumberDigits", Number(v))}
                      >
                        <SelectTrigger className="mt-1" data-testid="select-number-digits">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[3, 4, 5, 6, 7].map(d => (
                            <SelectItem key={d} value={String(d)}>
                              {d} หลัก (สูงสุด {Number("9".repeat(d)).toLocaleString()} รายการ)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="border rounded-lg p-3 bg-muted/30">
                      <Label className="text-xs text-muted-foreground mb-2 block">ตัวอย่างเลขที่เอกสาร</Label>
                      <div className="space-y-1">
                        {[
                          { key: "quotation", label: "ใบเสนอราคา" },
                          { key: "invoice", label: "ใบแจ้งหนี้" },
                          { key: "tax_invoice", label: "ใบกำกับภาษี" },
                          { key: "receipt", label: "ใบเสร็จ" },
                        ].map(doc => {
                          const pfx = resolvePrefix(doc.key, currentSettings.docPrefixes);
                          return (
                            <div key={doc.key} className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground w-20">{doc.label}:</span>
                              <span className="font-semibold">
                                {formatDocNumber(
                                  pfx,
                                  1,
                                  (currentSettings.docNumberFormat as DocNumberFormat) || "YMD_SEQ",
                                  currentSettings.docNumberDigits || 4,
                                  (currentSettings.dateEra as DateEra) || "CE"
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Hash className="h-4 w-4" /> Prefix เอกสาร (ตัวย่อนำหน้า)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      เพิ่ม prefix ได้หลายตัวต่อประเภทเอกสาร กดดาวเพื่อตั้งค่าเริ่มต้น
                    </p>
                    <PrefixEditor currentSettings={currentSettings} updateLocal={updateLocal} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calendar className="h-4 w-4" /> รูปแบบวันที่
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      เลือกรูปแบบปีที่แสดงบนเอกสาร
                    </p>
                    <div className="flex gap-2">
                      {[
                        { key: "BE", label: "พ.ศ. (ปีพุทธศักราช)", example: "2569" },
                        { key: "CE", label: "ค.ศ. (ปีคริสตศักราช)", example: "2026" },
                      ].map(opt => {
                        const isSelected = (currentSettings.dateEra || "CE") === opt.key;
                        return (
                          <button
                            key={opt.key}
                            onClick={() => updateLocal("dateEra", opt.key)}
                            className={`flex-1 rounded-lg border-2 p-3 text-left transition-all ${
                              isSelected ? "border-[#03c9d7] bg-[#e5f9fa] dark:bg-[#03c9d7]/15" : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                            }`}
                            data-testid={`button-era-${opt.key.toLowerCase()}`}
                          >
                            <div className={`text-sm font-medium`} style={isSelected ? { color: "#03c9d7" } : undefined}>
                              {opt.label}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              เช่น {opt.example}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calendar className="h-4 w-4" /> รูปแบบการแสดงวันที่
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      เลือกรูปแบบวันที่ที่จะแสดงในเอกสารและหน้าจอต่างๆ
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: "DD/MM/YYYY", example: "31/12/2026" },
                        { key: "MM/DD/YYYY", example: "12/31/2026" },
                        { key: "YYYY-MM-DD", example: "2026-12-31" },
                        { key: "DD-MM-YYYY", example: "31-12-2026" },
                        { key: "YYYY/MM/DD", example: "2026/12/31" },
                        { key: "DD.MM.YYYY", example: "31.12.2026" },
                      ].map(opt => {
                        const isSelected = (currentSettings.dateFormat || "DD/MM/YYYY") === opt.key;
                        return (
                          <button
                            key={opt.key}
                            onClick={() => updateLocal("dateFormat", opt.key)}
                            className={`rounded-lg border-2 p-2.5 text-left transition-all ${
                              isSelected ? "border-[#03c9d7] bg-[#e5f9fa] dark:bg-[#03c9d7]/15" : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                            }`}
                            data-testid={`button-dateformat-${opt.key.toLowerCase().replace(/[/\.]/g, '-')}`}
                          >
                            <div className={`text-xs font-medium`} style={isSelected ? { color: "#03c9d7" } : undefined}>
                              {opt.key}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {opt.example}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="images" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileImage className="h-4 w-4" /> โลโก้บริษัท
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ImageUploadBox
                      label="โลโก้บริษัท"
                      currentUrl={currentSettings.logoUrl}
                      onUploaded={(path) => { updateLocal("logoUrl", path); autoSaveField("logoUrl", path); }}
                      onClear={() => { updateLocal("logoUrl", null); autoSaveField("logoUrl", null); }}
                      accept="image/png,image/jpeg,image/webp"
                      testId="logo"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CreditCard className="h-4 w-4" /> QR Code ชำระเงิน
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ImageUploadBox
                      label="QR Code สำหรับโอนเงิน"
                      currentUrl={currentSettings.qrCodeUrl}
                      onUploaded={(path) => { updateLocal("qrCodeUrl", path); autoSaveField("qrCodeUrl", path); }}
                      onClear={() => { updateLocal("qrCodeUrl", null); autoSaveField("qrCodeUrl", null); }}
                      accept="image/png,image/jpeg,image/webp"
                      testId="qrcode"
                    />
                    <p className="text-[11px] text-muted-foreground mt-2">อัปโหลด QR Code จากธนาคาร (ใช้แทน PromptPay อัตโนมัติ)</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CreditCard className="h-4 w-4" /> พร้อมเพย์ (PromptPay) อัตโนมัติ
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={currentSettings.promptpayEnabled ?? false}
                        onCheckedChange={(v) => updateLocal("promptpayEnabled", v)}
                        data-testid="switch-promptpay-enabled"
                      />
                      <Label className="text-sm">เปิดใช้ PromptPay QR อัตโนมัติ</Label>
                    </div>
                    {currentSettings.promptpayEnabled && (
                      <>
                        <div className="space-y-2">
                          <Label className="text-xs">ประเภทหมายเลข</Label>
                          <Select
                            value={currentSettings.promptpayType || "phone"}
                            onValueChange={(v) => updateLocal("promptpayType", v)}
                          >
                            <SelectTrigger data-testid="select-promptpay-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="phone">เบอร์โทรศัพท์</SelectItem>
                              <SelectItem value="national_id">เลขบัตรประชาชน (13 หลัก)</SelectItem>
                              <SelectItem value="tax_id">เลขประจำตัวผู้เสียภาษี (13 หลัก)</SelectItem>
                              <SelectItem value="ewallet">e-Wallet ID (15 หลัก)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">
                            {currentSettings.promptpayType === "phone" ? "เบอร์โทรศัพท์" :
                             currentSettings.promptpayType === "national_id" ? "เลขบัตรประชาชน" :
                             currentSettings.promptpayType === "tax_id" ? "เลขประจำตัวผู้เสียภาษี" :
                             "e-Wallet ID"}
                          </Label>
                          <Input
                            placeholder={currentSettings.promptpayType === "phone" ? "0812345678" : "1234567890123"}
                            value={currentSettings.promptpayId || ""}
                            onChange={(e) => updateLocal("promptpayId", e.target.value)}
                            data-testid="input-promptpay-id"
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          ระบบจะสร้าง QR Code พร้อมเพย์อัตโนมัติพร้อมยอดเงินในเอกสาร (ถ้าไม่ได้อัปโหลด QR Code ด้านบน)
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/20">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="text-[10px] text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 bg-amber-100 dark:bg-amber-900/40 flex-shrink-0">ลายเซ็น</Badge>
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        ลายเซ็นจะตั้งค่ารายบุคคลที่โปรไฟล์ผู้ใช้งาน เพราะลายเซ็นจะติดตามตัวผู้ออกเอกสาร ไม่ใช่บริษัท
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="display" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">ตั้งค่าการแสดงผล</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>แสดงโลโก้</Label>
                        <p className="text-xs text-muted-foreground">แสดงโลโก้บริษัทบนเอกสาร</p>
                      </div>
                      <Switch
                        checked={currentSettings.showLogo}
                        onCheckedChange={v => updateLocal("showLogo", v)}
                        data-testid="switch-show-logo"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>แสดงลายเซ็น</Label>
                        <p className="text-xs text-muted-foreground">แสดงลายเซ็นผู้ออกเอกสารท้ายเอกสาร</p>
                      </div>
                      <Switch
                        checked={currentSettings.showSignature}
                        onCheckedChange={v => updateLocal("showSignature", v)}
                        data-testid="switch-show-signature"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>แสดงเลขประจำตัวผู้เสียภาษี</Label>
                        <p className="text-xs text-muted-foreground">แสดง Tax ID บนเอกสาร</p>
                      </div>
                      <Switch
                        checked={currentSettings.showTaxId}
                        onCheckedChange={v => updateLocal("showTaxId", v)}
                        data-testid="switch-show-taxid"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>แสดงสาขา</Label>
                        <p className="text-xs text-muted-foreground">แสดงสำนักงานใหญ่ / สาขาที่ (ข้อบังคับตามกฎหมายไทย)</p>
                      </div>
                      <Switch
                        checked={currentSettings.showBranch}
                        onCheckedChange={v => updateLocal("showBranch", v)}
                        data-testid="switch-show-branch"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>แสดงรหัสสินค้า</Label>
                        <p className="text-xs text-muted-foreground">แสดงคอลัมน์รหัสสินค้าในตารางรายการ</p>
                      </div>
                      <Switch
                        checked={currentSettings.showProductCode}
                        onCheckedChange={v => updateLocal("showProductCode", v)}
                        data-testid="switch-show-product-code"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">ขนาดกระดาษ & ตัวอักษร</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">ขนาดกระดาษ</Label>
                      <div className="flex gap-2">
                        {["A4", "A5"].map(size => (
                          <Button
                            key={size}
                            variant={currentSettings.paperSize === size ? "default" : "outline"}
                            size="sm"
                            onClick={() => updateLocal("paperSize", size)}
                            data-testid={`button-paper-${size.toLowerCase()}`}
                          >
                            {size}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">ขนาดตัวอักษร</Label>
                      <Select
                        value={currentSettings.docFontSize || "medium"}
                        onValueChange={v => updateLocal("docFontSize", v)}
                      >
                        <SelectTrigger data-testid="select-doc-font-size"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="small">เล็ก (10px)</SelectItem>
                          <SelectItem value="medium">กลาง (12px) — แนะนำ</SelectItem>
                          <SelectItem value="large">ใหญ่ (14px)</SelectItem>
                          <SelectItem value="xlarge">ใหญ่พิเศษ (16px)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">QR Code บนเอกสาร</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">แสดง QR Code</p>
                        <p className="text-xs text-muted-foreground">แสดง QR Code (PromptPay / ลิงก์ชำระเงิน) บนเอกสาร</p>
                      </div>
                      <Switch
                        checked={currentSettings.showQrOnDoc ?? true}
                        onCheckedChange={v => updateLocal("showQrOnDoc", v)}
                        data-testid="switch-show-qr-on-doc"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="xl:col-span-3">
            <Card className="sticky top-4">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Eye className="h-4 w-4" /> ตัวอย่างเอกสาร
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {docHistory.length > 0 && (
                      <button
                        onClick={navigateBack}
                        className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border hover:bg-muted/50 transition-colors text-muted-foreground"
                        data-testid="button-doc-back"
                      >
                        <ArrowLeft className="h-3 w-3" />
                        ย้อนกลับ
                      </button>
                    )}
                    {selectedDocInfo && selectedTheme && (
                      <Badge
                        variant="outline"
                        className="text-xs"
                        style={{ color: selectedTheme.primary, borderColor: selectedTheme.primary + "50" }}
                      >
                        {selectedDocInfo.label}
                      </Badge>
                    )}
                    {nextDocs.length > 0 && (
                      <div className="flex items-center gap-1">
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        {nextDocs.slice(0, 2).map(nd => {
                          const ndTheme = getDocTypeColor(nd.key, categoryColorsMap);
                          return (
                            <button
                              key={nd.key}
                              onClick={() => navigateToDoc(nd.key)}
                              className="text-[10px] px-1.5 py-0.5 rounded border hover:bg-muted/50 transition-colors"
                              style={{ color: ndTheme.primary, borderColor: ndTheme.primary + "30" }}
                              data-testid={`button-next-${nd.key}`}
                            >
                              {nd.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                {refDoc && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    อ้างอิงจาก: {refDoc.type} เลขที่ {refDoc.number}
                  </p>
                )}
              </CardHeader>
              <CardContent className="p-3">
                <DocumentPreview
                  settings={currentSettings}
                  company={selectedCompany}
                  userSignature={userSignature}
                  documentType={previewDocType}
                  referenceDoc={refDoc}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {hasChanges && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
            <div className="flex items-center gap-3 bg-white dark:bg-slate-800 border dark:border-slate-600 shadow-lg rounded-full px-6 py-3">
              <span className="text-sm text-muted-foreground">มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก</span>
              <Button variant="outline" size="sm" onClick={() => setLocalSettings(null)} data-testid="button-cancel-changes">
                ยกเลิก
              </Button>
              <Button
                size="sm"
                className="text-white hover:opacity-90"
                style={{ background: "#03c9d7" }}
                onClick={handleSave}
                disabled={saveMutation.isPending}
                data-testid="button-save-floating"
              >
                {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                บันทึก
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
