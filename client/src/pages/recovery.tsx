import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Database, CheckCircle, XCircle, Loader2, Shield } from "lucide-react";

interface RecoveryStatus {
  recoveryMode: boolean;
  configBootstrapped: boolean;
  hasConfigDb: boolean;
  mainDbReachable: boolean;
  mainDbError: string | null;
  mainDbName: string | null;
}

interface TestResult {
  ok: boolean;
  db?: string;
  port?: string;
  version?: string;
  error?: string;
}

export default function RecoveryPage() {
  const [status, setStatus] = useState<RecoveryStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionString, setConnectionString] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string } | null>(null);

  const checkStatus = async () => {
    try {
      const res = await fetch("/api/recovery/status");
      const data = await res.json();
      setStatus(data);
      if (!data.recoveryMode) {
        window.location.href = "/";
      }
    } catch {
      setStatus(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/recovery/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ ok: false, error: err.message });
    }
    setTesting(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch("/api/recovery/update-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString }),
      });
      const data = await res.json();
      if (data.ok) {
        setSaveResult({ ok: true, message: data.message });
        setTimeout(() => { window.location.href = "/"; }, 2000);
      } else {
        setSaveResult({ ok: false, message: data.message });
      }
    } catch (err: any) {
      setSaveResult({ ok: false, message: err.message });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!status?.recoveryMode) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Card className="w-[500px]">
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-bold">ระบบทำงานปกติ</p>
            <p className="text-sm text-gray-500 mt-2">ไม่จำเป็นต้องใช้ Recovery Mode</p>
            <Button className="mt-4" onClick={() => window.location.href = "/"} data-testid="btn-go-home">
              กลับหน้าหลัก
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-4">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Database Recovery</h1>
          <p className="text-sm text-gray-500 mt-1">ฐานข้อมูลหลักเข้าไม่ได้ — ระบุ connection ใหม่</p>
        </div>

        <Card className="border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-red-700">
              <XCircle className="h-4 w-4" /> สถานะปัจจุบัน
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between p-2 bg-red-50 rounded">
              <span className="text-gray-600">ฐานข้อมูลหลัก</span>
              <span className="text-red-600 font-bold">เข้าไม่ได้</span>
            </div>
            {status.mainDbError && (
              <div className="p-2 bg-gray-50 rounded">
                <span className="text-xs text-gray-500 font-mono">{status.mainDbError}</span>
              </div>
            )}
            <div className="flex justify-between p-2 bg-green-50 rounded">
              <span className="text-gray-600">Config DB (local)</span>
              <span className="text-green-600 font-bold flex items-center gap-1">
                <Shield className="h-3 w-3" /> ผ่าน Encryption แล้ว
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-600" /> ระบุ Connection String ของฐานข้อมูลใหม่
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm">PostgreSQL Connection String *</Label>
              <Input
                value={connectionString}
                onChange={e => setConnectionString(e.target.value)}
                placeholder="postgresql://user:password@host:port/database"
                className="font-mono text-xs"
                data-testid="input-recovery-connection"
              />
              <p className="text-xs text-gray-400 mt-1">connection string เต็มของฐานข้อมูลที่ rebuild แล้ว</p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleTest}
                disabled={!connectionString || testing}
                data-testid="btn-recovery-test"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Database className="h-4 w-4 mr-1" />}
                {testing ? "กำลังทดสอบ..." : "ทดสอบ Connection"}
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                onClick={handleSave}
                disabled={!connectionString || !testResult?.ok || saving}
                data-testid="btn-recovery-save"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                {saving ? "กำลังบันทึก..." : "บันทึก + เชื่อมต่อ"}
              </Button>
            </div>

            {testResult && (
              <div className={`p-3 rounded-lg border text-sm ${testResult.ok ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                {testResult.ok ? (
                  <div className="space-y-1">
                    <p className="font-bold text-green-700 flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" /> ต่อได้!
                    </p>
                    <p className="text-xs text-green-600">Database: {testResult.db} | Port: {testResult.port}</p>
                    <p className="text-xs text-green-600">{testResult.version}</p>
                  </div>
                ) : (
                  <div>
                    <p className="font-bold text-red-700 flex items-center gap-1">
                      <XCircle className="h-4 w-4" /> ต่อไม่ได้
                    </p>
                    <p className="text-xs text-red-600 font-mono mt-1">{testResult.error}</p>
                  </div>
                )}
              </div>
            )}

            {saveResult && (
              <div className={`p-3 rounded-lg border text-sm ${saveResult.ok ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                <p className={`font-bold ${saveResult.ok ? "text-green-700" : "text-red-700"}`}>
                  {saveResult.ok ? "✓" : "✗"} {saveResult.message}
                </p>
                {saveResult.ok && <p className="text-xs text-green-600 mt-1">กำลัง redirect ไปหน้าหลัก...</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
