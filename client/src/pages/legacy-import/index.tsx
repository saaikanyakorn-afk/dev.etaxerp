import { useState, useCallback, useRef } from "react";
import LegacyLayout from "@/components/legacy-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FileSpreadsheet,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Package,
  Users,
  BookOpen,
  Receipt,
  FileText,
  Building2,
  X,
} from "lucide-react";

interface ParsedTable {
  name: string;
  rowCount: number;
  columns: string[];
  sampleRows: Record<string, string>[];
}

interface ImportSummary {
  companyName: string;
  companyId: string;
  tables: ParsedTable[];
  totalRows: number;
  dateRange: { from: string; to: string };
}

const TABLE_GROUPS: Record<string, { label: string; icon: any; color: string; tables: string[] }> = {
  accounting: {
    label: "บัญชี/GL",
    icon: BookOpen,
    color: "text-blue-600 bg-blue-50",
    tables: ["gl", "gl_tran", "gl_report", "gl_purchase_report", "mbook", "chart_of_account"],
  },
  sales: {
    label: "เอกสารขาย",
    icon: Receipt,
    color: "text-green-600 bg-green-50",
    tables: ["bill", "bill_item", "bn", "bn_item", "quotation", "quotation_item"],
  },
  purchase: {
    label: "สั่งซื้อ/จ่ายชำระ",
    icon: FileText,
    color: "text-orange-600 bg-orange-50",
    tables: ["po", "po_item", "payment", "payment_item", "payment_fee", "expense", "expense_item", "expense_x"],
  },
  receive: {
    label: "รับชำระ/WHT",
    icon: Receipt,
    color: "text-cyan-600 bg-cyan-50",
    tables: ["receipt", "receipt_item", "receipt_fee", "wht", "wht_item", "wht_contact"],
  },
  contacts: {
    label: "คู่ค้า",
    icon: Users,
    color: "text-violet-600 bg-violet-50",
    tables: ["contact", "contact_etax"],
  },
  inventory: {
    label: "สินค้า/สต๊อก",
    icon: Package,
    color: "text-amber-600 bg-amber-50",
    tables: ["inventory", "inventory_balance", "pack"],
  },
  hr: {
    label: "HR/Payroll",
    icon: Users,
    color: "text-pink-600 bg-pink-50",
    tables: [
      "hr_payroll", "hr_payroll_item", "hr_applicant", "hr_setting",
      "drhr_applicant", "drhr_attendance", "drhr_holiday", "drhr_leave",
      "drhr_leave_setting", "drhr_ot", "drhr_salary", "drhr_setting",
    ],
  },
  settings: {
    label: "ตั้งค่า/อื่นๆ",
    icon: Building2,
    color: "text-gray-600 bg-gray-50",
    tables: [
      "company_setting", "asset", "etax", "etax_email_setting",
      "dropbox", "dropbox_url", "importer", "gmail_setting", "category",
    ],
  },
};

export default function LegacyImportPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const csvFiles = selected.filter(f => f.name.endsWith(".csv"));
    if (csvFiles.length === 0) {
      toast({ title: "กรุณาเลือกไฟล์ CSV", variant: "destructive" });
      return;
    }
    setFiles(prev => [...prev, ...csvFiles]);
    setSummary(null);
    setGenerated(false);
  }, [toast]);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setSummary(null);
    setGenerated(false);
  }, []);

  const handleUpload = useCallback(async () => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach(f => formData.append("csvFiles", f));

      const res = await fetch("/api/legacy-import/parse", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSummary(data);
      toast({ title: `วิเคราะห์สำเร็จ — ${data.tables.length} ตาราง, ${data.totalRows.toLocaleString()} แถว` });
    } catch (err: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [files, toast]);

  const handleGenerateZip = useCallback(async () => {
    if (!summary) return;
    setGenerating(true);
    try {
      const formData = new FormData();
      files.forEach(f => formData.append("csvFiles", f));

      const res = await fetch("/api/legacy-import/generate-zip", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const filename = summary.companyName
        ? `TRCloud_${summary.companyId}_${summary.companyName.replace(/[^ก-๙a-zA-Z0-9]/g, "_")}.zip`
        : `TRCloud_${summary.companyId || "export"}.zip`;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
      setGenerated(true);
      toast({ title: "ดาวน์โหลด ZIP สำเร็จ!" });
    } catch (err: any) {
      toast({ title: "สร้าง ZIP ไม่สำเร็จ", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }, [files, summary, toast]);

  const handleClear = useCallback(() => {
    setFiles([]);
    setSummary(null);
    setGenerated(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast({ title: "ล้างข้อมูลแล้ว — พร้อมทำลูกค้าคนต่อไป" });
  }, [toast]);

  const getTableGroup = (tableName: string) => {
    const base = tableName.replace(/_p\d+of\d+.*$/, "");
    for (const [key, group] of Object.entries(TABLE_GROUPS)) {
      if (group.tables.includes(base)) return { key, ...group };
    }
    return { key: "other", label: "อื่นๆ", icon: FileText, color: "text-gray-600 bg-gray-50", tables: [] };
  };

  return (
    <LegacyLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800" data-testid="text-page-title">นำเข้าข้อมูล TRCloud</h1>
          <p className="text-sm text-slate-500 mt-1">Upload CSV จาก TRCloud ทีละลูกค้า → วิเคราะห์ → สร้าง ZIP → ดาวน์โหลด → ล้าง → ทำคนต่อไป</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            { step: 1, label: "Upload CSV", desc: "เลือกไฟล์ CSV ทั้งหมดของลูกค้า", active: files.length === 0 },
            { step: 2, label: "วิเคราะห์", desc: "ตรวจสอบข้อมูลที่ import", active: files.length > 0 && !summary },
            { step: 3, label: "สร้าง ZIP", desc: "ดาวน์โหลดไฟล์ Archive", active: !!summary && !generated },
            { step: 4, label: "ล้าง & ถัดไป", desc: "ล้างข้อมูล ทำลูกค้าคนต่อไป", active: generated },
          ].map((s) => (
            <div
              key={s.step}
              className={`rounded-lg border p-3 text-center transition-all ${
                s.active ? "border-indigo-400 bg-indigo-50 shadow-sm" : "border-slate-200 bg-white"
              }`}
            >
              <div className={`text-lg font-bold ${s.active ? "text-indigo-600" : "text-slate-400"}`}>
                ขั้นที่ {s.step}
              </div>
              <div className={`text-sm font-medium ${s.active ? "text-indigo-700" : "text-slate-500"}`}>{s.label}</div>
              <div className="text-xs text-slate-400 mt-0.5">{s.desc}</div>
            </div>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4.5 w-4.5 text-indigo-500" />
              เลือกไฟล์ CSV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              data-testid="dropzone-csv"
            >
              <FileSpreadsheet className="h-12 w-12 mx-auto text-slate-400 mb-3" />
              <p className="text-sm font-medium text-slate-600">คลิกเพื่อเลือกไฟล์ CSV หรือลากวาง</p>
              <p className="text-xs text-slate-400 mt-1">รองรับ .csv — เลือกได้หลายไฟล์พร้อมกัน</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                data-testid="input-csv-files"
              />
            </div>

            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-sm font-medium text-slate-700">ไฟล์ที่เลือก ({files.length} ไฟล์)</div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm" data-testid={`file-item-${i}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <FileSpreadsheet className="h-4 w-4 text-green-600 shrink-0" />
                        <span className="truncate">{f.name}</span>
                        <span className="text-xs text-slate-400 shrink-0">({(f.size / 1024).toFixed(0)} KB)</span>
                      </div>
                      <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500 shrink-0" data-testid={`button-remove-file-${i}`}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="bg-indigo-600 hover:bg-indigo-700"
                    data-testid="button-analyze"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        กำลังวิเคราะห์...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        วิเคราะห์ข้อมูล
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()} data-testid="button-add-more-files">
                    เพิ่มไฟล์
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {summary && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4.5 w-4.5 text-green-500" />
                  สรุปข้อมูล
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-500">Company ID</div>
                    <div className="text-lg font-bold text-slate-800" data-testid="text-company-id">{summary.companyId}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-500">ชื่อบริษัท</div>
                    <div className="text-sm font-bold text-slate-800 truncate" data-testid="text-company-name">{summary.companyName || "-"}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-500">จำนวนตาราง</div>
                    <div className="text-lg font-bold text-slate-800" data-testid="text-table-count">{summary.tables.length}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-500">จำนวนแถวทั้งหมด</div>
                    <div className="text-lg font-bold text-slate-800" data-testid="text-total-rows">{summary.totalRows.toLocaleString()}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  {Object.entries(TABLE_GROUPS).map(([key, group]) => {
                    const groupTables = summary.tables.filter(t => {
                      const base = t.name.replace(/_p\d+of\d+.*$/, "");
                      return group.tables.includes(base);
                    });
                    if (groupTables.length === 0) return null;
                    const GroupIcon = group.icon;
                    return (
                      <div key={key} className="border rounded-lg">
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-t-lg ${group.color}`}>
                          <GroupIcon className="h-4 w-4" />
                          <span className="text-sm font-medium">{group.label}</span>
                          <span className="text-xs opacity-70">({groupTables.length} ตาราง)</span>
                        </div>
                        <div className="divide-y">
                          {groupTables.map(t => (
                            <div key={t.name} className="flex items-center justify-between px-3 py-2 text-sm" data-testid={`table-row-${t.name}`}>
                              <div className="flex items-center gap-2">
                                <FileSpreadsheet className="h-3.5 w-3.5 text-slate-400" />
                                <span className="font-mono text-xs">{t.name}</span>
                              </div>
                              <span className="text-slate-500">{t.rowCount.toLocaleString()} แถว</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {(() => {
                    const ungrouped = summary.tables.filter(t => {
                      const base = t.name.replace(/_p\d+of\d+.*$/, "");
                      return !Object.values(TABLE_GROUPS).some(g => g.tables.includes(base));
                    });
                    if (ungrouped.length === 0) return null;
                    return (
                      <div className="border rounded-lg">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-t-lg text-gray-600 bg-gray-50">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm font-medium">อื่นๆ</span>
                          <span className="text-xs opacity-70">({ungrouped.length} ตาราง)</span>
                        </div>
                        <div className="divide-y">
                          {ungrouped.map(t => (
                            <div key={t.name} className="flex items-center justify-between px-3 py-2 text-sm">
                              <div className="flex items-center gap-2">
                                <FileSpreadsheet className="h-3.5 w-3.5 text-slate-400" />
                                <span className="font-mono text-xs">{t.name}</span>
                              </div>
                              <span className="text-slate-500">{t.rowCount.toLocaleString()} แถว</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                onClick={handleGenerateZip}
                disabled={generating}
                size="lg"
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-generate-zip"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    กำลังสร้าง ZIP...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    สร้าง ZIP & ดาวน์โหลด
                  </>
                )}
              </Button>

              {generated && (
                <Button
                  onClick={handleClear}
                  size="lg"
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                  data-testid="button-clear"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  ล้างข้อมูล & ทำคนต่อไป
                </Button>
              )}
            </div>
          </>
        )}

        {!files.length && !summary && (
          <Card className="bg-blue-50/50 border-blue-200">
            <CardContent className="pt-5">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">วิธีใช้งาน</p>
                  <ol className="list-decimal ml-4 space-y-1 text-blue-700">
                    <li>Export CSV จาก TRCloud ของลูกค้า 1 ราย (ทุกตาราง)</li>
                    <li>คลิก "เลือกไฟล์ CSV" แล้วเลือกไฟล์ทั้งหมด</li>
                    <li>กด "วิเคราะห์ข้อมูล" เพื่อตรวจสอบ</li>
                    <li>กด "สร้าง ZIP & ดาวน์โหลด" เพื่อเก็บ Archive</li>
                    <li>กด "ล้างข้อมูล" แล้วทำลูกค้าคนต่อไป</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </LegacyLayout>
  );
}
