import { useState, useCallback, useRef } from "react";
import LegacyLayout from "@/components/legacy-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  FileSpreadsheet,
  FileArchive,
  Database,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  BookOpen,
  Users,
  Building2,
  Trash2,
} from "lucide-react";

interface ParseSummary {
  companyName: string;
  companyId: string;
  tables: { name: string; rowCount: number; columns: string[]; sampleRows?: Record<string, string>[]; }[];
  totalRows: number;
  dateRange: { from: string; to: string };
}

interface ImportResult {
  success: boolean;
  companyId: number;
  companyName: string;
  accountsInserted: number;
  contactsInserted: number;
  tablesCount: number;
  totalRows: number;
}

type ImportMode = "csv" | "zip";

export default function ImportToDbPage() {
  const [mode, setMode] = useState<ImportMode>("zip");
  const [csvFiles, setCsvFiles] = useState<File[]>([]);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [summary, setSummary] = useState<ParseSummary | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { colors: themeColors } = useThemeColor();
  const queryClient = useQueryClient();

  const handleCsvSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const files = selected.filter(f => f.name.endsWith(".csv"));
    if (files.length === 0) {
      toast({ title: "กรุณาเลือกไฟล์ CSV", variant: "destructive" });
      return;
    }
    setCsvFiles(prev => [...prev, ...files]);
    setSummary(null);
    setResult(null);
  }, [toast]);

  const handleZipSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.endsWith(".zip")) {
      toast({ title: "กรุณาเลือกไฟล์ ZIP", variant: "destructive" });
      return;
    }
    setZipFile(file);
    setSummary(null);
    setResult(null);
  }, [toast]);

  const removeCsvFile = useCallback((index: number) => {
    setCsvFiles(prev => prev.filter((_, i) => i !== index));
    setSummary(null);
    setResult(null);
  }, []);

  const hasFiles = mode === "csv" ? csvFiles.length > 0 : zipFile !== null;

  const handleAnalyze = useCallback(async () => {
    if (!hasFiles) return;
    setAnalyzing(true);
    try {
      if (mode === "csv") {
        const formData = new FormData();
        csvFiles.forEach(f => formData.append("csvFiles", f));
        const res = await fetch("/api/legacy-import/parse", { method: "POST", body: formData, credentials: "include" });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setSummary(data);
        toast({ title: `วิเคราะห์สำเร็จ — ${data.tables.length} ตาราง, ${data.totalRows.toLocaleString()} แถว` });
      } else {
        const formData = new FormData();
        formData.append("zipFile", zipFile!);
        const res = await fetch("/api/legacy-import/read-zip", { method: "POST", body: formData, credentials: "include" });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setSummary({ ...data, dateRange: data.dateRange || { from: "-", to: "-" } });
        toast({ title: `วิเคราะห์สำเร็จ — ${data.tables.length} ตาราง, ${data.totalRows.toLocaleString()} แถว` });
      }
    } catch (err: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  }, [mode, csvFiles, zipFile, hasFiles, toast]);

  const handleImportToDb = useCallback(async () => {
    if (!summary) return;
    setImporting(true);
    try {
      const formData = new FormData();
      let url: string;

      if (mode === "csv") {
        csvFiles.forEach(f => formData.append("csvFiles", f));
        url = "/api/legacy-import/import-to-db";
      } else {
        formData.append("zipFile", zipFile!);
        url = "/api/legacy-import/import-zip-to-db";
      }

      const res = await fetch(url, { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/legacy-import/companies"] });
      toast({ title: `นำเข้าสำเร็จ — ${data.companyName}` });
    } catch (err: any) {
      toast({ title: "นำเข้าไม่สำเร็จ", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }, [mode, csvFiles, zipFile, summary, toast, queryClient]);

  const handleClear = useCallback(() => {
    setCsvFiles([]);
    setZipFile(null);
    setSummary(null);
    setResult(null);
    if (csvInputRef.current) csvInputRef.current.value = "";
    if (zipInputRef.current) zipInputRef.current.value = "";
  }, []);

  const currentStep = !hasFiles ? 1 : !summary ? 2 : !result ? 3 : 4;

  return (
    <LegacyLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg text-white" style={{ background: themeColors.primary }}>
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-page-title">นำเข้าข้อมูล → ฐานข้อมูล</h1>
            <p className="text-sm text-gray-500">Upload CSV หรือ ZIP จาก TRCloud → วิเคราะห์ → บันทึกลงฐานข้อมูล</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            { step: 1, label: "เลือกไฟล์", desc: "CSV หรือ ZIP" },
            { step: 2, label: "วิเคราะห์", desc: "ตรวจสอบข้อมูล" },
            { step: 3, label: "นำเข้า DB", desc: "บันทึกลงฐานข้อมูล" },
            { step: 4, label: "เสร็จสิ้น", desc: "ดูข้อมูลที่นำเข้า" },
          ].map((s) => (
            <div
              key={s.step}
              className={`rounded-lg border p-3 text-center transition-all ${
                currentStep === s.step ? "border-2 shadow-sm" : currentStep > s.step ? "border-green-300 bg-green-50" : "border-slate-200 bg-white"
              }`}
              style={currentStep === s.step ? { borderColor: themeColors.primary, background: themeColors.primaryLight } : undefined}
            >
              <div className={`text-lg font-bold ${currentStep > s.step ? "text-green-600" : ""}`} style={currentStep === s.step ? { color: themeColors.primary } : undefined}>
                {currentStep > s.step ? <CheckCircle2 className="h-5 w-5 mx-auto" /> : `ขั้นที่ ${s.step}`}
              </div>
              <div className="text-sm font-medium text-slate-600">{s.label}</div>
              <div className="text-xs text-slate-400 mt-0.5">{s.desc}</div>
            </div>
          ))}
        </div>

        {!result && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Upload className="h-4.5 w-4.5" style={{ color: themeColors.primary }} />
                  เลือกไฟล์
                </CardTitle>
                <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                  <button
                    onClick={() => { setMode("zip"); handleClear(); }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${mode === "zip" ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
                    data-testid="button-mode-zip"
                  >
                    <FileArchive className="h-3.5 w-3.5 inline mr-1" />
                    ZIP
                  </button>
                  <button
                    onClick={() => { setMode("csv"); handleClear(); }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${mode === "csv" ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
                    data-testid="button-mode-csv"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 inline mr-1" />
                    CSV
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {mode === "zip" ? (
                <>
                  <div
                    className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-slate-400 transition-colors cursor-pointer"
                    onClick={() => zipInputRef.current?.click()}
                    data-testid="dropzone-zip"
                  >
                    <FileArchive className="h-12 w-12 mx-auto text-slate-400 mb-3" />
                    <p className="text-sm font-medium text-slate-600">คลิกเพื่อเลือกไฟล์ ZIP</p>
                    <p className="text-xs text-slate-400 mt-1">รองรับ ZIP ที่มี CSV หรือ ZIP ที่สร้างจากระบบนี้</p>
                    <input
                      ref={zipInputRef}
                      type="file"
                      accept=".zip"
                      className="hidden"
                      onChange={handleZipSelect}
                      data-testid="input-zip-file"
                    />
                  </div>
                  {zipFile && (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileArchive className="h-4 w-4 text-blue-600 shrink-0" />
                          <span className="truncate">{zipFile.name}</span>
                          <span className="text-xs text-slate-400 shrink-0">({(zipFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                        </div>
                        <button onClick={() => { setZipFile(null); setSummary(null); }} className="text-slate-400 hover:text-red-500 shrink-0">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <Button
                        onClick={handleAnalyze}
                        disabled={analyzing}
                        style={{ background: themeColors.primary }}
                        className="text-white mt-3"
                        data-testid="button-analyze-zip"
                      >
                        {analyzing ? (
                          <><Loader2 className="h-4 w-4 animate-spin mr-2" />กำลังวิเคราะห์...</>
                        ) : (
                          <><Upload className="h-4 w-4 mr-2" />วิเคราะห์ข้อมูล</>
                        )}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div
                    className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-slate-400 transition-colors cursor-pointer"
                    onClick={() => csvInputRef.current?.click()}
                    data-testid="dropzone-csv-db"
                  >
                    <FileSpreadsheet className="h-12 w-12 mx-auto text-slate-400 mb-3" />
                    <p className="text-sm font-medium text-slate-600">คลิกเพื่อเลือกไฟล์ CSV</p>
                    <p className="text-xs text-slate-400 mt-1">รองรับ .csv — เลือกได้หลายไฟล์พร้อมกัน</p>
                    <input
                      ref={csvInputRef}
                      type="file"
                      accept=".csv"
                      multiple
                      className="hidden"
                      onChange={handleCsvSelect}
                      data-testid="input-csv-files-db"
                    />
                  </div>
                  {csvFiles.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="text-sm font-medium text-slate-700">ไฟล์ที่เลือก ({csvFiles.length} ไฟล์)</div>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {csvFiles.map((f, i) => (
                          <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileSpreadsheet className="h-4 w-4 text-green-600 shrink-0" />
                              <span className="truncate">{f.name}</span>
                              <span className="text-xs text-slate-400 shrink-0">({(f.size / 1024).toFixed(0)} KB)</span>
                            </div>
                            <button onClick={() => removeCsvFile(i)} className="text-slate-400 hover:text-red-500 shrink-0">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          onClick={handleAnalyze}
                          disabled={analyzing}
                          style={{ background: themeColors.primary }}
                          className="text-white"
                          data-testid="button-analyze-db"
                        >
                          {analyzing ? (
                            <><Loader2 className="h-4 w-4 animate-spin mr-2" />กำลังวิเคราะห์...</>
                          ) : (
                            <><Upload className="h-4 w-4 mr-2" />วิเคราะห์ข้อมูล</>
                          )}
                        </Button>
                        <Button variant="outline" onClick={() => csvInputRef.current?.click()}>เพิ่มไฟล์</Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {summary && !result && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4.5 w-4.5 text-green-500" />
                  สรุปข้อมูลที่จะนำเข้า
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-500">Company ID</div>
                    <div className="text-lg font-bold text-slate-800">{summary.companyId || "-"}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-500">ชื่อบริษัท</div>
                    <div className="text-sm font-bold text-slate-800 truncate">{summary.companyName || "-"}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-500">จำนวนตาราง</div>
                    <div className="text-lg font-bold text-slate-800">{summary.tables.length}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-500">จำนวนแถวทั้งหมด</div>
                    <div className="text-lg font-bold text-slate-800">{summary.totalRows.toLocaleString()}</div>
                  </div>
                </div>
                {summary.dateRange && summary.dateRange.from !== "-" && (
                  <div className="text-sm text-slate-500 mb-4">
                    ช่วงวันที่: {summary.dateRange.from} ถึง {summary.dateRange.to}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                onClick={handleImportToDb}
                disabled={importing}
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white"
                data-testid="button-import-to-db"
              >
                {importing ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />กำลังนำเข้า...</>
                ) : (
                  <><Database className="h-4 w-4 mr-2" />นำเข้าลงฐานข้อมูล</>
                )}
              </Button>
            </div>
          </>
        )}

        {result && (
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
                <h2 className="text-lg font-bold text-green-800">นำเข้าสำเร็จ!</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-lg mx-auto">
                  <div className="bg-white rounded-lg p-3 border">
                    <Building2 className="h-4 w-4 mx-auto text-slate-400 mb-1" />
                    <div className="text-xs text-slate-500">บริษัท</div>
                    <div className="text-sm font-bold truncate">{result.companyName}</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <BookOpen className="h-4 w-4 mx-auto text-blue-400 mb-1" />
                    <div className="text-xs text-slate-500">ผังบัญชี</div>
                    <div className="text-sm font-bold">{result.accountsInserted} รายการ</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <Users className="h-4 w-4 mx-auto text-violet-400 mb-1" />
                    <div className="text-xs text-slate-500">คู่ค้า</div>
                    <div className="text-sm font-bold">{result.contactsInserted} รายการ</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <FileSpreadsheet className="h-4 w-4 mx-auto text-green-400 mb-1" />
                    <div className="text-xs text-slate-500">ตาราง</div>
                    <div className="text-sm font-bold">{result.tablesCount} ตาราง</div>
                  </div>
                </div>
                <div className="flex gap-3 justify-center pt-2">
                  <Button
                    onClick={handleClear}
                    variant="outline"
                    data-testid="button-clear-and-next"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    ล้าง & ทำคนต่อไป
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!hasFiles && !summary && !result && (
          <Card className="bg-blue-50/50 border-blue-200">
            <CardContent className="pt-5">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">วิธีใช้งาน</p>
                  <ol className="list-decimal ml-4 space-y-1 text-blue-700">
                    <li>เลือกโหมด ZIP หรือ CSV (แนะนำ ZIP เพราะสะดวกกว่า)</li>
                    <li>Upload ไฟล์ ZIP/CSV จาก TRCloud ของลูกค้า</li>
                    <li>กด "วิเคราะห์ข้อมูล" เพื่อตรวจสอบ</li>
                    <li>กด "นำเข้าลงฐานข้อมูล" เพื่อบันทึกข้อมูลถาวร</li>
                    <li>ไปที่ "ผังบัญชี" หรือ "คู่ค้า" เพื่อดูข้อมูลที่นำเข้า</li>
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
