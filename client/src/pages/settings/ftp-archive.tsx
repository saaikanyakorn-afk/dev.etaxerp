import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../lib/queryClient";
import Layout from "@/components/layout";
import SettingsTabs from "@/components/settings-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, HardDrive, Server, TestTube, Play, RotateCcw, Link, AlertTriangle, CheckCircle, XCircle, Clock, FileArchive, Timer, Gauge, ArrowUpDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

function formatBytes(bytes: number | string): string {
  const b = typeof bytes === "string" ? parseInt(bytes) : bytes;
  if (!b || b === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDate(d: string | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
}

function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return "-";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec} วินาที`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (min < 60) return `${min} นาที ${remSec} วินาที`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return `${hr} ชม. ${remMin} นาที`;
}

function formatRelative(d: string | null): string {
  if (!d) return "-";
  const diff = Date.now() - new Date(d).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "เมื่อสักครู่";
  if (min < 60) return `${min} นาทีที่แล้ว`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ชั่วโมงที่แล้ว`;
  const day = Math.floor(hr / 24);
  return `${day} วันที่แล้ว`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; icon: any }> = {
    completed: { color: "bg-green-100 text-green-700", icon: CheckCircle },
    failed: { color: "bg-red-100 text-red-700", icon: XCircle },
    running: { color: "bg-blue-100 text-blue-700", icon: Loader2 },
    partial: { color: "bg-yellow-100 text-yellow-700", icon: AlertTriangle },
    pending: { color: "bg-gray-100 text-gray-600", icon: Clock },
    transferring: { color: "bg-blue-100 text-blue-700", icon: Loader2 },
    skipped: { color: "bg-gray-100 text-gray-500", icon: Clock },
  };
  const { color, icon: Icon } = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${color}`} data-testid={`status-badge-${status}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
}

export default function FtpArchivePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expandedJob, setExpandedJob] = useState<number | null>(null);

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["/api/ftp-archive/settings"],
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/ftp-archive/stats"],
  });

  const { data: lastRun } = useQuery({
    queryKey: ["/api/ftp-archive/last-run"],
  });

  const { data: jobs } = useQuery({
    queryKey: ["/api/ftp-archive/jobs"],
  });

  const { data: jobItems } = useQuery({
    queryKey: ["/api/ftp-archive/jobs", expandedJob, "items"],
    enabled: !!expandedJob,
    queryFn: async () => {
      const res = await fetch(`/api/ftp-archive/jobs/${expandedJob}/items`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load items");
      return res.json();
    },
  });

  const [form, setForm] = useState<any>({});

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", "/api/ftp-archive/settings", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "บันทึกสำเร็จ", description: "ตั้งค่า FTP Archive อัปเดตแล้ว" });
      qc.invalidateQueries({ queryKey: ["/api/ftp-archive/settings"] });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const data = { ...(settings as any), ...form };
      const res = await apiRequest("POST", "/api/ftp-archive/test-connection", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: "เชื่อมต่อสำเร็จ", description: data.message });
      } else {
        toast({ title: "เชื่อมต่อไม่สำเร็จ", description: data.message, variant: "destructive" });
      }
    },
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ftp-archive/run");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: data.success ? "เสร็จสิ้น" : "มีข้อผิดพลาด", description: data.message, variant: data.success ? "default" : "destructive" });
      qc.invalidateQueries({ queryKey: ["/api/ftp-archive/jobs"] });
      qc.invalidateQueries({ queryKey: ["/api/ftp-archive/stats"] });
      qc.invalidateQueries({ queryKey: ["/api/ftp-archive/last-run"] });
    },
  });

  const updateLinksMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ftp-archive/update-links");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "อัปเดต Link สำเร็จ", description: `อัปเดต ${data.updatedLinks} รายการ` });
    },
  });

  const retryMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ftp-archive/retry-failed");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Retry สำเร็จ", description: `ส่งใหม่ ${data.retriedItems} รายการ` });
      qc.invalidateQueries({ queryKey: ["/api/ftp-archive/stats"] });
    },
  });

  const checkStaleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ftp-archive/check-stale");
      return res.json();
    },
    onSuccess: (data: any) => {
      const msg = data.staleCount === 0 
        ? "ไม่มีรายการค้าง" 
        : `พบ ${data.staleCount} รายการค้าง${data.alerted ? " - ส่งแจ้งเตือน LINE แล้ว" : ""}`;
      toast({ title: "ตรวจสอบเสร็จ", description: msg });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({ ...(settings as any), ...form });
  };

  const getField = (key: string, fallback: any = "") => {
    if (key in form) return form[key];
    return (settings as any)?.[key] ?? fallback;
  };

  const setField = (key: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [key]: value }));
  };

  if (settingsLoading) {
    return (
      <Layout>
        <SettingsTabs />
        <div className="flex items-center justify-center h-64" data-testid="loading-spinner">
          <Loader2 className="w-8 h-8 animate-spin text-[#fb9678]" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SettingsTabs />
      <div className="p-6 space-y-6 max-w-6xl mx-auto" data-testid="ftp-archive-page">
      <div className="flex items-center gap-3">
        <HardDrive className="w-7 h-7 text-[#fb9678]" />
        <h1 className="text-2xl font-bold text-gray-800" data-testid="page-title">FTP Archive — จัดเก็บไฟล์แนบเอกสาร</h1>
      </div>
      <p className="text-sm text-gray-500">โอนย้ายไฟล์เอกสารเก่าไปเก็บที่ FTP Server ภายนอก เพื่อลดพื้นที่จัดเก็บ — รองรับ Resume Transfer, ตรวจสอบขนาดไฟล์, และแจ้งเตือน LINE</p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4" data-testid="archive-stats">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600" data-testid="stat-completed">{(stats as any)?.completed || 0}</div>
            <div className="text-xs text-gray-500">สำเร็จ</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-500" data-testid="stat-failed">{(stats as any)?.failed || 0}</div>
            <div className="text-xs text-gray-500">ล้มเหลว</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-500" data-testid="stat-pending">{(stats as any)?.pending || 0}</div>
            <div className="text-xs text-gray-500">รอดำเนินการ</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-500" data-testid="stat-skipped">{(stats as any)?.skipped || 0}</div>
            <div className="text-xs text-gray-500">ข้าม</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-[#fb9678]" data-testid="stat-archived-size">{formatBytes((stats as any)?.archived_bytes || 0)}</div>
            <div className="text-xs text-gray-500">ขนาดที่โอนแล้ว</div>
          </CardContent>
        </Card>
      </div>

      {/* Last Run Statistics */}
      {lastRun && (lastRun as any)?.jobId && (
        <Card data-testid="last-run-card" className="border-l-4 border-l-[#fb9678]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-2">
                <Timer className="w-5 h-5 text-[#fb9678]" />
                สถิติการรันครั้งล่าสุด
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={(lastRun as any).status} />
                <span className="text-xs text-gray-400 font-normal" data-testid="text-last-run-time">
                  {formatRelative((lastRun as any).startedAt)}
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-3" data-testid="last-run-duration">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  ระยะเวลา
                </div>
                <div className="text-sm font-semibold">{formatDuration((lastRun as any).durationMs)}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3" data-testid="last-run-throughput">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                  <Gauge className="w-3.5 h-3.5" />
                  ความเร็วเฉลี่ย
                </div>
                <div className="text-sm font-semibold">
                  {(lastRun as any).throughputBytesPerSec > 0
                    ? `${formatBytes((lastRun as any).throughputBytesPerSec)}/s`
                    : "-"}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3" data-testid="last-run-transferred">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  โอนแล้ว
                </div>
                <div className="text-sm font-semibold">
                  {formatBytes((lastRun as any).items?.transferredBytes || 0)}
                  <span className="text-xs text-gray-400 ml-1">
                    / {formatBytes((lastRun as any).items?.totalBytes || 0)}
                  </span>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3" data-testid="last-run-verified">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  ตรวจสอบแล้ว
                </div>
                <div className="text-sm font-semibold">
                  {(lastRun as any).items?.verifiedCount || 0} / {(lastRun as any).items?.total || 0} ไฟล์
                </div>
              </div>
            </div>

            {(() => {
              const lr = lastRun as any;
              const total = lr.totalFiles || 0;
              const done = (lr.transferredFiles || 0) + (lr.skippedFiles || 0);
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <div data-testid="last-run-progress">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">ความคืบหน้า</span>
                    <span className="text-xs font-medium">{pct}% ({lr.transferredFiles || 0} สำเร็จ, {lr.failedFiles || 0} ล้มเหลว, {lr.skippedFiles || 0} ข้าม จาก {total} ไฟล์)</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })()}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-gray-500">เริ่มต้น:</span>{" "}
                <span className="font-medium" data-testid="text-started-at">{formatDate((lastRun as any).startedAt)}</span>
              </div>
              <div>
                <span className="text-gray-500">เสร็จสิ้น:</span>{" "}
                <span className="font-medium" data-testid="text-completed-at">{formatDate((lastRun as any).completedAt)}</span>
              </div>
              <div>
                <span className="text-gray-500">ลองสูงสุด:</span>{" "}
                <span className="font-medium" data-testid="text-max-attempts">{(lastRun as any).items?.maxAttempts || 0} ครั้ง</span>
              </div>
              <div>
                <span className="text-gray-500">Job ID:</span>{" "}
                <span className="font-medium" data-testid="text-job-id">#{(lastRun as any).jobId}</span>
              </div>
            </div>

            {(lastRun as any).errorSummary && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700" data-testid="last-run-error">
                <span className="font-medium">ข้อผิดพลาด:</span> {(lastRun as any).errorSummary}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Settings */}
      <Card data-testid="settings-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Server className="w-5 h-5" />
            ตั้งค่า FTP Server
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-3">
            <Switch
              checked={getField("enabled", false)}
              onCheckedChange={(v) => setField("enabled", v)}
              data-testid="switch-enabled"
            />
            <Label>เปิดใช้งานระบบ FTP Archive</Label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>FTP Host</Label>
              <Input value={getField("ftpHost")} onChange={(e) => setField("ftpHost", e.target.value)} placeholder="ftp.example.com" data-testid="input-ftp-host" />
            </div>
            <div>
              <Label>FTP Port</Label>
              <Input type="number" value={getField("ftpPort", 21)} onChange={(e) => setField("ftpPort", parseInt(e.target.value))} data-testid="input-ftp-port" />
            </div>
            <div>
              <Label>Protocol</Label>
              <Select value={getField("ftpProtocol", "ftps")} onValueChange={(v) => setField("ftpProtocol", v)}>
                <SelectTrigger data-testid="select-protocol">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ftp">FTP</SelectItem>
                  <SelectItem value="ftps">FTPS (TLS)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Username</Label>
              <Input value={getField("ftpUser")} onChange={(e) => setField("ftpUser", e.target.value)} data-testid="input-ftp-user" />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" value={getField("ftpPassword")} onChange={(e) => setField("ftpPassword", e.target.value)} data-testid="input-ftp-password" />
            </div>
            <div>
              <Label>Remote Path</Label>
              <Input value={getField("ftpRemotePath", "/archive")} onChange={(e) => setField("ftpRemotePath", e.target.value)} placeholder="/archive" data-testid="input-remote-path" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Web Base URL — FQDN (สำหรับเข้าถึงจากภายนอก)</Label>
              <Input value={getField("ftpBaseUrl")} onChange={(e) => setField("ftpBaseUrl", e.target.value)} placeholder="http://tax-gateway.hopto.org/fa/archive" data-testid="input-ftp-base-url" />
              <p className="text-xs text-gray-400 mt-1">URL หลักสำหรับเปิดไฟล์ archive ผ่านอินเทอร์เน็ต (FQDN)</p>
            </div>
            <div>
              <Label>Web Base URL — LAN (สำหรับเข้าถึงจากสำนักงานใหญ่)</Label>
              <Input value={getField("ftpLanBaseUrl")} onChange={(e) => setField("ftpLanBaseUrl", e.target.value)} placeholder="http://192.168.1.100/fa/archive" data-testid="input-ftp-lan-base-url" />
              <p className="text-xs text-gray-400 mt-1">URL สำรองเมื่ออินเทอร์เน็ตขัดข้อง — ใช้ได้เฉพาะคอมพิวเตอร์ในออฟฟิศ</p>
            </div>
            <div className="flex flex-col gap-3 justify-center">
              <div className="flex items-center gap-3">
                <Switch
                  checked={getField("ftpPassive", true)}
                  onCheckedChange={(v) => setField("ftpPassive", v)}
                  data-testid="switch-passive"
                />
                <Label>Passive Mode</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={getField("resumeEnabled", true)}
                  onCheckedChange={(v) => setField("resumeEnabled", v)}
                  data-testid="switch-resume"
                />
                <Label>Resume Transfer (REST)</Label>
              </div>
            </div>
          </div>

          <hr />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>เวลา Batch ครั้งที่ 1</Label>
              <Input value={getField("scheduleTime1", "02:00")} onChange={(e) => setField("scheduleTime1", e.target.value)} placeholder="02:00" data-testid="input-schedule-1" />
            </div>
            <div>
              <Label>เวลา Batch ครั้งที่ 2</Label>
              <Input value={getField("scheduleTime2", "14:00")} onChange={(e) => setField("scheduleTime2", e.target.value)} placeholder="14:00" data-testid="input-schedule-2" />
            </div>
            <div>
              <Label>อายุไฟล์ขั้นต่ำ (เดือน)</Label>
              <Input type="number" value={getField("fileAgeMonths", 12)} onChange={(e) => setField("fileAgeMonths", parseInt(e.target.value))} min={6} max={36} data-testid="input-file-age" />
            </div>
            <div>
              <Label>แจ้งเตือนหลัง (วัน)</Label>
              <Input type="number" value={getField("alertAfterDays", 3)} onChange={(e) => setField("alertAfterDays", parseInt(e.target.value))} min={1} max={14} data-testid="input-alert-days" />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-[#fb9678] hover:bg-[#e88568]" data-testid="button-save">
              {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              บันทึกตั้งค่า
            </Button>
            <Button variant="outline" onClick={() => testMutation.mutate()} disabled={testMutation.isPending} data-testid="button-test">
              {testMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TestTube className="w-4 h-4 mr-2" />}
              ทดสอบเชื่อมต่อ
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card data-testid="actions-card">
        <CardHeader>
          <CardTitle className="text-lg">การดำเนินการ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending} className="bg-green-600 hover:bg-green-700" data-testid="button-run-archive">
              {runMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              สั่งโอนไฟล์ทันที
            </Button>
            <Button variant="outline" onClick={() => updateLinksMutation.mutate()} disabled={updateLinksMutation.isPending} data-testid="button-update-links">
              {updateLinksMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link className="w-4 h-4 mr-2" />}
              อัปเดต Link เอกสาร
            </Button>
            <Button variant="outline" onClick={() => retryMutation.mutate()} disabled={retryMutation.isPending} data-testid="button-retry-failed">
              {retryMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
              Retry รายการที่ล้มเหลว
            </Button>
            <Button variant="outline" onClick={() => checkStaleMutation.mutate()} disabled={checkStaleMutation.isPending} data-testid="button-check-stale">
              {checkStaleMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
              ตรวจสอบรายการค้าง
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Job History */}
      <Card data-testid="job-history-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileArchive className="w-5 h-5" />
            ประวัติการโอนไฟล์
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!jobs || (jobs as any[]).length === 0 ? (
            <p className="text-sm text-gray-500" data-testid="no-jobs">ยังไม่มีประวัติการโอนไฟล์</p>
          ) : (
            <div className="space-y-2">
              {(jobs as any[]).map((job: any) => (
                <div key={job.id} className="border rounded-lg" data-testid={`job-row-${job.id}`}>
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                  >
                    <div className="flex items-center gap-3">
                      <StatusBadge status={job.status} />
                      <span className="text-sm font-medium">Job #{job.id}</span>
                      <span className="text-xs text-gray-500">{formatDate(job.startedAt)}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>สำเร็จ: {job.transferredFiles}/{job.totalFiles}</span>
                      <span>ล้มเหลว: {job.failedFiles}</span>
                      <span>ข้าม: {job.skippedFiles}</span>
                    </div>
                  </div>
                  {expandedJob === job.id && jobItems && (
                    <div className="border-t px-3 pb-3">
                      <table className="w-full text-xs mt-2">
                        <thead>
                          <tr className="text-left text-gray-500">
                            <th className="pb-1">ตาราง</th>
                            <th className="pb-1">ID</th>
                            <th className="pb-1">ไฟล์</th>
                            <th className="pb-1">ขนาด</th>
                            <th className="pb-1">สถานะ</th>
                            <th className="pb-1">ลอง</th>
                            <th className="pb-1">ข้อผิดพลาด</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(jobItems as any[]).map((item: any) => (
                            <tr key={item.id} className="border-t" data-testid={`item-row-${item.id}`}>
                              <td className="py-1">{item.sourceTable}</td>
                              <td className="py-1">{item.sourceId}</td>
                              <td className="py-1 max-w-[200px] truncate">{item.localPath}</td>
                              <td className="py-1">{formatBytes(item.fileSize)}</td>
                              <td className="py-1"><StatusBadge status={item.status} /></td>
                              <td className="py-1">{item.attempts}</td>
                              <td className="py-1 text-red-500 max-w-[200px] truncate">{item.errorMessage || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </Layout>
  );
}
