import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, History, Loader2 } from "lucide-react";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useHrCompanyId } from "@/lib/company-context";

export default function ScannerImport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const companyId = useHrCompanyId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [scannerDeviceId, setScannerDeviceId] = useState("default");
  const [preview, setPreview] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: importLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/scanner-import-logs", companyId],
    queryFn: async () => {
      const r = await fetch("/api/scanner-import-logs", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!companyId,
  });

  const previewMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("scannerDeviceId", scannerDeviceId);
      const r = await fetch("/api/scanner-import/preview", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: (data) => {
      setPreview(data);
    },
    onError: (err: any) => {
      toast({ title: "ไม่สามารถอ่านไฟล์ได้", description: err.message, variant: "destructive" });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      previewMutation.mutate(file);
    }
  };

  const handleConfirmImport = async () => {
    if (!preview || !selectedFile) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("scannerDeviceId", scannerDeviceId);
      const r = await fetch("/api/scanner-import/confirm", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      const result = await r.json();
      toast({
        title: "นำเข้าสำเร็จ",
        description: `สร้างเวลาเข้า ${result.created} รายการ, อัปเดตเวลาออก ${result.updated} รายการ`,
        variant: "success" as any,
      });
      setPreview(null);
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["/api/scanner-import-logs", companyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
    } catch (err: any) {
      toast({ title: "นำเข้าไม่สำเร็จ", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Upload className="h-6 w-6" style={{ color: "#03c9d7" }} />
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-scanner-import-title">นำเข้าข้อมูลจากเครื่องสแกน</h1>
        </div>

        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-slate-400" /> อัพโหลดไฟล์ข้อมูลสแกน
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              รองรับไฟล์ CSV, Excel (.xlsx), DAT, TXT จากซอฟต์แวร์เครื่องสแกน (ZKTeco, HikVision และอื่น ๆ)
              <br />รูปแบบ: รหัสพนักงาน, วันเวลา, ประเภท(เข้า/ออก)
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label>รหัสเครื่องสแกน (Device ID)</Label>
                <Input
                  value={scannerDeviceId}
                  onChange={(e) => setScannerDeviceId(e.target.value)}
                  placeholder="เช่น ZK-001"
                  data-testid="input-import-device-id"
                />
              </div>
              <div>
                <Label>เลือกไฟล์</Label>
                <Input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.dat,.txt"
                  onChange={handleFileChange}
                  disabled={previewMutation.isPending}
                  data-testid="input-import-file"
                />
              </div>
            </div>
            {previewMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" /> กำลังอ่านไฟล์...
              </div>
            )}
          </CardContent>
        </Card>

        {preview && (
          <>
            <Card className="shadow-sm border-slate-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">ตรวจสอบข้อมูลก่อนนำเข้า</CardTitle>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">ไฟล์: <span className="font-medium">{preview.filename}</span></span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="p-3 bg-slate-50 rounded-lg border text-center">
                    <p className="text-xs text-muted-foreground font-bold uppercase">ทั้งหมด</p>
                    <p className="text-2xl font-bold" style={{ color: "#03c9d7" }} data-testid="text-preview-total">{preview.summary.total}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 text-center">
                    <p className="text-xs text-emerald-600 font-bold uppercase">จับคู่ได้</p>
                    <p className="text-2xl font-bold text-emerald-600" data-testid="text-preview-matched">{preview.summary.matched}</p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 text-center">
                    <p className="text-xs text-amber-600 font-bold uppercase">จับคู่ไม่ได้</p>
                    <p className="text-2xl font-bold text-amber-600" data-testid="text-preview-unmatched">{preview.summary.unmatched}</p>
                  </div>
                </div>

                {preview.summary.unmatched > 0 && (
                  <div className="flex items-center gap-2 p-3 mb-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>มี {preview.summary.unmatched} รายการที่ไม่สามารถจับคู่พนักงานได้ รายการเหล่านี้จะถูกข้ามไป กรุณาตั้งค่าจับคู่รหัสเครื่องสแกนก่อน</span>
                  </div>
                )}

                <div className="border rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0">
                      <TableRow>
                        <TableHead className="text-xs">สถานะ</TableHead>
                        <TableHead className="text-xs">รหัสพนักงาน (สแกน)</TableHead>
                        <TableHead className="text-xs">พนักงานในระบบ</TableHead>
                        <TableHead className="text-xs">วันที่</TableHead>
                        <TableHead className="text-xs">เวลา</TableHead>
                        <TableHead className="text-xs">ประเภท</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.records.map((r: any, i: number) => (
                        <TableRow key={i} className={!r.matched ? "bg-amber-50/50" : ""} data-testid={`row-preview-${i}`}>
                          <TableCell>
                            {r.matched ? (
                              <CheckCircle className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                            )}
                          </TableCell>
                          <TableCell className="text-sm font-mono">{r.employeeCode}</TableCell>
                          <TableCell className="text-sm">{r.employeeName || <span className="text-amber-500 text-xs">ไม่พบ</span>}</TableCell>
                          <TableCell className="text-sm">{r.date}</TableCell>
                          <TableCell className="text-sm">{new Date(r.timestamp).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={r.type === "in" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"}>
                              {r.type === "in" ? "เข้า" : "ออก"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => { setPreview(null); setSelectedFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                    data-testid="button-cancel-import"
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    onClick={handleConfirmImport}
                    disabled={importing || preview.summary.matched === 0}
                    style={{ backgroundColor: "#03c9d7" }}
                    className="text-white"
                    data-testid="button-confirm-import"
                  >
                    {importing ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> กำลังนำเข้า...</>
                    ) : (
                      `ยืนยันนำเข้า ${preview.summary.matched} รายการ`
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5 text-slate-400" /> ประวัติการนำเข้า
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs">วันที่นำเข้า</TableHead>
                  <TableHead className="text-xs">ชื่อไฟล์</TableHead>
                  <TableHead className="text-xs text-right">ทั้งหมด</TableHead>
                  <TableHead className="text-xs text-right">จับคู่ได้</TableHead>
                  <TableHead className="text-xs text-right">จับคู่ไม่ได้</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importLogs.length > 0 ? importLogs.map((log: any) => (
                  <TableRow key={log.id} data-testid={`row-import-log-${log.id}`}>
                    <TableCell className="text-sm">
                      {log.importedAt ? new Date(log.importedAt).toLocaleString("th-TH") : "-"}
                    </TableCell>
                    <TableCell className="text-sm font-mono">{log.filename}</TableCell>
                    <TableCell className="text-sm text-right font-bold">{log.totalRecords}</TableCell>
                    <TableCell className="text-sm text-right text-emerald-600 font-bold">{log.matchedRecords}</TableCell>
                    <TableCell className="text-sm text-right text-amber-600 font-bold">{log.unmatchedRecords}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                      ยังไม่มีประวัติการนำเข้า
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
