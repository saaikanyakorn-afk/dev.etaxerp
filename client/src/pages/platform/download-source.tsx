import { useState } from "react";
import PlatformLayout from "@/components/platform-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Code, Download, Loader2, AlertCircle, CheckCircle2, FileArchive } from "lucide-react";

export default function DownloadSource() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleDownload = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/platform/download-source", {
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "เกิดข้อผิดพลาด");
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition") || "";
      const filenameMatch = contentDisposition.match(/filename="?([^";\n]+)"?/);
      const filename = filenameMatch?.[1] || `etax-source-${new Date().toISOString().slice(0, 10)}.zip`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      const sizeMB = (blob.size / 1024 / 1024).toFixed(1);
      setSuccess(`ดาวน์โหลดสำเร็จ! ไฟล์ ${filename} (${sizeMB} MB) กำลังบันทึก`);
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาดในการดาวน์โหลด");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PlatformLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-download-title">ดาวน์โหลด Source Code</h1>
          <p className="text-gray-500 mt-1">ดาวน์โหลด Source Code ปัจจุบันเป็นไฟล์ ZIP</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Code className="h-5 w-5 text-blue-500" />
                  Source Code ปัจจุบัน
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <FileArchive className="h-5 w-5 text-gray-500 mt-0.5" />
                    <div className="text-sm text-gray-600">
                      <p>ระบบจะ zip source code ณ เวลาที่กดดาวน์โหลด โดย <strong>ไม่รวม</strong> โฟลเดอร์ต่อไปนี้:</p>
                      <ul className="mt-2 space-y-1 list-disc list-inside text-xs text-gray-500">
                        <li>node_modules (dependencies)</li>
                        <li>.git (version control history)</li>
                        <li>.cache, .config, dist (ไฟล์ชั่วคราว)</li>
                        <li>attached_assets (ไฟล์แนบ)</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg" data-testid="alert-error">
                    <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg" data-testid="alert-success">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-green-700">{success}</p>
                  </div>
                )}

                <Button
                  onClick={handleDownload}
                  disabled={loading}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                  data-testid="button-download-source"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      กำลังสร้างไฟล์ ZIP... กรุณารอสักครู่
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      ดาวน์โหลด Source Code (.zip)
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">หมายเหตุ</h3>
                    <ul className="mt-2 text-xs text-gray-600 space-y-1.5 list-disc list-inside">
                      <li>ไฟล์จะถูกสร้างใหม่ทุกครั้งที่กดดาวน์โหลด</li>
                      <li>รวม source code ล่าสุด ณ เวลาที่กด</li>
                      <li>ไม่รวม database — ใช้เมนู "สำรองข้อมูล" แยกต่างหาก</li>
                      <li>หลังดาวน์โหลดให้รัน <code className="bg-gray-100 px-1 rounded">npm install</code> เพื่อติดตั้ง dependencies</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PlatformLayout>
  );
}
