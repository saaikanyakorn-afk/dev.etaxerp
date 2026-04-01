import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PlatformLayout from "@/components/platform-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Wrench, Power, PowerOff, Clock, AlertTriangle, CheckCircle2,
  Calendar, History, Shield, XCircle, RefreshCw, Ban
} from "lucide-react";

function fmtDate(d: string | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleString("th-TH", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

interface MaintenanceStatus {
  enabled: boolean;
  message: string;
  scheduledAt: string | null;
  activatedAt: string | null;
  createdBy: string | null;
  scheduleId: number | null;
  cloneInProgress: boolean;
  cloneSessionUserId: number | null;
  source: string | null;
}

interface HistoryRow {
  id: number;
  scheduledAt: string;
  message: string;
  createdBy: string | null;
  createdAt: string;
  status: string;
  activatedAt: string | null;
  liftedAt: string | null;
  liftedBy: string | null;
  source: string;
  completedDate: string | null;
}

export default function PlatformMaintenance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("ระบบอยู่ระหว่างการปรับปรุง กรุณารอสักครู่");
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleMessage, setScheduleMessage] = useState("ระบบอยู่ระหว่างการปรับปรุง กรุณารอสักครู่");
  const [rescheduleStart, setRescheduleStart] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const { data: status, isLoading } = useQuery<MaintenanceStatus>({
    queryKey: ["/api/maintenance/status"],
    queryFn: async () => {
      const r = await fetch("/api/maintenance/status", { credentials: "include" });
      return r.json();
    },
    refetchInterval: 5000,
  });

  const { data: todayCheck } = useQuery<{ completedToday: boolean }>({
    queryKey: ["/api/maintenance/today-completed"],
    queryFn: async () => {
      const r = await fetch("/api/maintenance/today-completed", { credentials: "include" });
      return r.json();
    },
    refetchInterval: 30000,
  });

  const { data: history = [] } = useQuery<HistoryRow[]>({
    queryKey: ["/api/maintenance/history"],
    queryFn: async () => {
      const r = await fetch("/api/maintenance/history", { credentials: "include" });
      return r.json();
    },
    enabled: showHistory,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/maintenance/status"] });
    queryClient.invalidateQueries({ queryKey: ["/api/maintenance/today-completed"] });
    queryClient.invalidateQueries({ queryKey: ["/api/maintenance/history"] });
  };

  const enableMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/maintenance/enable", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ message }),
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.message); }
      return r.json();
    },
    onSuccess: (res) => { toast({ title: "สำเร็จ", description: res.message }); invalidateAll(); },
    onError: (err: any) => toast({ title: "ไม่สามารถเปิดได้", description: err.message, variant: "destructive" }),
  });

  const disableMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/maintenance/disable", { method: "POST", credentials: "include" });
      if (!r.ok) { const err = await r.json(); throw new Error(err.message); }
      return r.json();
    },
    onSuccess: (res) => { toast({ title: "สำเร็จ", description: res.message }); invalidateAll(); },
    onError: (err: any) => toast({ title: "ไม่สามารถปิดได้", description: err.message, variant: "destructive" }),
  });

  const scheduleMut = useMutation({
    mutationFn: async () => {
      if (!scheduleStart) throw new Error("กรุณาเลือกเวลาเริ่มต้น");
      const diffMs = new Date(scheduleStart).getTime() - Date.now();
      if (diffMs < 60 * 60 * 1000) throw new Error("ต้องตั้งเวลาล่วงหน้าอย่างน้อย 1 ชั่วโมง");
      const r = await fetch("/api/maintenance/schedule", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ startAt: scheduleStart, message: scheduleMessage }),
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.message); }
      return r.json();
    },
    onSuccess: (res) => {
      toast({ title: "สำเร็จ", description: res.message });
      invalidateAll();
      setScheduleStart("");
    },
    onError: (err: any) => toast({ title: "ไม่สามารถตั้งเวลาได้", description: err.message, variant: "destructive" }),
  });

  const rescheduleMut = useMutation({
    mutationFn: async () => {
      if (!rescheduleStart) throw new Error("กรุณาเลือกเวลาใหม่");
      const diffMs = new Date(rescheduleStart).getTime() - Date.now();
      if (diffMs < 60 * 60 * 1000) throw new Error("ต้องตั้งเวลาล่วงหน้าอย่างน้อย 1 ชั่วโมง");
      const r = await fetch("/api/maintenance/reschedule", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ startAt: rescheduleStart }),
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.message); }
      return r.json();
    },
    onSuccess: (res) => {
      toast({ title: "สำเร็จ", description: res.message });
      invalidateAll();
      setRescheduleStart("");
    },
    onError: (err: any) => toast({ title: "ไม่สามารถเลื่อนได้", description: err.message, variant: "destructive" }),
  });

  const cancelMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/maintenance/cancel", { method: "POST", credentials: "include" });
      if (!r.ok) { const err = await r.json(); throw new Error(err.message); }
      return r.json();
    },
    onSuccess: (res) => { toast({ title: "สำเร็จ", description: res.message }); invalidateAll(); },
    onError: (err: any) => toast({ title: "ผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const isEnabled = status?.enabled === true;
  const hasPending = !isEnabled && !!status?.scheduledAt;
  const completedToday = todayCheck?.completedToday === true;
  const scheduleTimeTooSoon = scheduleStart ? (new Date(scheduleStart).getTime() - Date.now()) < 60 * 60 * 1000 : false;
  const rescheduleTimeTooSoon = rescheduleStart ? (new Date(rescheduleStart).getTime() - Date.now()) < 60 * 60 * 1000 : false;
  const cloneActive = status?.cloneInProgress === true;

  const STATUS_COLORS: Record<string, string> = {
    pending: "bg-blue-100 text-blue-700",
    active: "bg-amber-100 text-amber-700",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-gray-100 text-gray-500",
  };

  return (
    <PlatformLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-maintenance-title">ปรับปรุงระบบ (Maintenance Mode)</h1>
          <p className="text-gray-500 mt-1">ล็อกระบบชั่วคราว — ผู้ใช้ทั่วไปจะไม่สามารถเข้าสู่ระบบได้ ต้องปลดล็อกด้วยตนเอง</p>
        </div>

        <Card className={`border-2 ${isEnabled ? "border-amber-400 bg-amber-50" : hasPending ? "border-blue-400 bg-blue-50" : "border-green-400 bg-green-50"}`} data-testid="card-maintenance-status">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {isEnabled ? (
                  <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                    <Wrench className="h-6 w-6 text-amber-600 animate-pulse" />
                  </div>
                ) : hasPending ? (
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-blue-600" />
                  </div>
                ) : (
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  </div>
                )}
                <div>
                  <p className="text-lg font-bold" data-testid="text-maintenance-state">
                    {isLoading ? "กำลังโหลด..." : isEnabled ? "ระบบอยู่ในโหมดปรับปรุง (ล็อก)" : hasPending ? "มี Schedule รอดำเนินการ" : "ระบบทำงานปกติ"}
                  </p>
                  {isEnabled && status?.message && (
                    <p className="text-sm text-amber-700 mt-1">{status.message}</p>
                  )}
                  {isEnabled && status?.activatedAt && (
                    <p className="text-xs text-amber-600 mt-1">
                      เปิดตั้งแต่: {fmtDate(status.activatedAt)} โดย {status.createdBy || "-"}
                    </p>
                  )}
                  {isEnabled && cloneActive && (
                    <p className="text-xs text-red-600 mt-1 font-semibold">
                      <Shield className="h-3 w-3 inline mr-1" />
                      กำลังมีการ Clone Database อยู่ — ไม่สามารถปิดโหมดปรับปรุงได้จนกว่าจะเสร็จ
                    </p>
                  )}
                  {hasPending && (
                    <p className="text-sm text-blue-600 mt-1">
                      <Clock className="h-3.5 w-3.5 inline mr-1" />
                      จะเริ่มล็อก: {fmtDate(status?.scheduledAt || null)} โดย {status?.createdBy || "-"}
                    </p>
                  )}
                  {completedToday && !isEnabled && !hasPending && (
                    <p className="text-xs text-amber-600 mt-1">
                      <Ban className="h-3 w-3 inline mr-1" />
                      วันนี้เคยเปิดและปิดโหมดปรับปรุงไปแล้ว — ไม่สามารถเปิดใหม่ได้อีกในวันเดียวกัน
                    </p>
                  )}
                </div>
              </div>
              <div className="h-4 w-4 rounded-full animate-pulse" style={{ background: isEnabled ? "#f59e0b" : hasPending ? "#3b82f6" : "#22c55e" }} />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card data-testid="card-immediate-maintenance">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {isEnabled ? <PowerOff className="h-4 w-4 text-green-600" /> : <Power className="h-4 w-4 text-amber-600" />}
                {isEnabled ? "ปิดโหมดปรับปรุง (ปลดล็อก)" : "เปิดโหมดปรับปรุงทันที (ล็อกระบบ)"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isEnabled ? (
                <>
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <div className="flex gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-amber-800">
                        <p className="font-semibold">ผลกระทบ:</p>
                        <ul className="mt-1 space-y-1 text-xs">
                          <li>- ผู้ใช้ที่ล็อกอินอยู่จะถูก Force Logout ทันที</li>
                          <li>- หน้า Login จะแสดงข้อความปรับปรุงระบบ</li>
                          <li>- ไม่สามารถเข้าสู่ระบบได้จนกว่าจะ<strong>ปลดล็อกด้วยตนเอง</strong></li>
                          <li>- Super Admin ยังเข้าได้ตามปกติ</li>
                          <li>- <strong>ไม่สามารถล็อกได้อีกในวันเดียวกัน</strong>หลังปลดล็อกแล้ว</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">ข้อความแจ้งผู้ใช้</Label>
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={2}
                      className="text-sm"
                      data-testid="input-maintenance-message"
                    />
                  </div>
                  <Button
                    onClick={() => enableMut.mutate()}
                    disabled={enableMut.isPending || completedToday || hasPending}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                    data-testid="btn-enable-maintenance"
                  >
                    <Power className="h-4 w-4 mr-2" />
                    {enableMut.isPending ? "กำลังดำเนินการ..." : completedToday ? "ไม่สามารถเปิดได้ (เปิดไปแล้ววันนี้)" : hasPending ? "มี schedule อยู่แล้ว" : "เปิดโหมดปรับปรุงทันที"}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600">ระบบอยู่ในโหมดปรับปรุง กดปุ่มด้านล่างเพื่อเปิดให้ผู้ใช้เข้าสู่ระบบได้ตามปกติ</p>
                  {cloneActive && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                      <div className="flex gap-2">
                        <Shield className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-red-800">กำลังมีการ Clone Database อยู่ — ปุ่มปิดจะถูกปิดกั้นจนกว่าจะเสร็จ</p>
                      </div>
                    </div>
                  )}
                  <Button
                    onClick={() => disableMut.mutate()}
                    disabled={disableMut.isPending || cloneActive}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    data-testid="btn-disable-maintenance"
                  >
                    <PowerOff className="h-4 w-4 mr-2" />
                    {disableMut.isPending ? "กำลังดำเนินการ..." : cloneActive ? "Clone กำลังทำงาน — รอก่อน" : "ปิดโหมดปรับปรุง — ปลดล็อกระบบ"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-schedule-maintenance">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                ตั้งเวลาล็อกระบบล่วงหน้า
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasPending ? (
                <>
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <p className="text-sm text-blue-800 font-semibold">มี schedule อยู่แล้ว</p>
                    <p className="text-xs text-blue-600 mt-1">จะเริ่ม: {fmtDate(status?.scheduledAt || null)}</p>
                    <p className="text-xs text-blue-600">สร้างโดย: {status?.createdBy || "-"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">เลื่อนเวลาใหม่ (ล่วงหน้าอย่างน้อย 1 ชม.)</Label>
                    <Input
                      type="datetime-local"
                      value={rescheduleStart}
                      onChange={(e) => setRescheduleStart(e.target.value)}
                      min={new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)}
                      className="text-sm"
                      data-testid="input-reschedule-start"
                    />
                  </div>
                  {rescheduleTimeTooSoon && rescheduleStart && (
                    <p className="text-xs text-red-500 font-medium">เวลาที่เลือกใกล้เกินไป — ต้องล่วงหน้าอย่างน้อย 1 ชั่วโมง</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => rescheduleMut.mutate()}
                      disabled={rescheduleMut.isPending || !rescheduleStart || rescheduleTimeTooSoon}
                      variant="outline"
                      className="flex-1"
                      data-testid="btn-reschedule"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      {rescheduleMut.isPending ? "กำลังเลื่อน..." : rescheduleTimeTooSoon ? "ใกล้เกินไป (ขั้นต่ำ 1 ชม.)" : "เลื่อนเวลา"}
                    </Button>
                    <Button
                      onClick={() => cancelMut.mutate()}
                      disabled={cancelMut.isPending}
                      variant="outline"
                      className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                      data-testid="btn-cancel-schedule"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      {cancelMut.isPending ? "กำลังยกเลิก..." : "ยกเลิก schedule"}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm">เวลาที่จะเริ่มล็อกระบบ</Label>
                    <Input
                      type="datetime-local"
                      value={scheduleStart}
                      onChange={(e) => setScheduleStart(e.target.value)}
                      min={new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)}
                      className="text-sm"
                      data-testid="input-schedule-start"
                    />
                    {scheduleTimeTooSoon ? (
                      <p className="text-xs text-red-500 font-medium">เวลาที่เลือกใกล้เกินไป — ต้องตั้งเวลาล่วงหน้าอย่างน้อย 1 ชั่วโมง</p>
                    ) : (
                      <p className="text-xs text-gray-400">ต้องตั้งเวลาล่วงหน้าอย่างน้อย 1 ชั่วโมง — ระบบจะ Force Logout ผู้ใช้ทั้งหมดเมื่อถึงเวลา ต้องมาปลดล็อกเอง</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">ข้อความ</Label>
                    <Textarea
                      value={scheduleMessage}
                      onChange={(e) => setScheduleMessage(e.target.value)}
                      rows={2}
                      className="text-sm"
                      data-testid="input-schedule-message"
                    />
                  </div>
                  <Button
                    onClick={() => scheduleMut.mutate()}
                    disabled={scheduleMut.isPending || !scheduleStart || isEnabled || completedToday || scheduleTimeTooSoon}
                    className="w-full"
                    variant="outline"
                    data-testid="btn-schedule-maintenance"
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    {scheduleMut.isPending ? "กำลังตั้งเวลา..." : completedToday ? "ไม่สามารถตั้งเวลาได้ (เปิดไปแล้ววันนี้)" : scheduleTimeTooSoon ? "เวลาใกล้เกินไป (ขั้นต่ำ 1 ชม.)" : "ตั้งเวลาล็อกระบบ"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
          <div className="text-sm text-gray-600 space-y-1">
            <p className="font-semibold">กฎสำคัญ:</p>
            <ul className="text-xs space-y-0.5 pl-4">
              <li>• มีได้เพียง 1 schedule เท่านั้น — หากมีอยู่แล้ว ต้องเลื่อนหรือยกเลิกก่อน</li>
              <li>• ต้องตั้งเวลาล่วงหน้าอย่างน้อย 1 ชั่วโมง</li>
              <li>• ต้องปลดล็อกด้วยตนเอง — ระบบจะไม่ปลดล็อกอัตโนมัติ</li>
              <li>• เมื่อปลดล็อกแล้ว จะไม่สามารถล็อกได้อีกในวันเดียวกัน</li>
              <li>• ขณะ Clone Database อยู่ จะไม่สามารถปลดล็อกได้จนกว่าจะเสร็จ</li>
              <li>• เมื่อระบบถูกล็อก มีเพียง Super Admin เท่านั้นที่เข้าได้</li>
            </ul>
          </div>
        </div>

        <Card>
          <CardHeader className="cursor-pointer" onClick={() => setShowHistory(!showHistory)}>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-gray-600" />
              ประวัติการปรับปรุงระบบ
              <span className="text-xs text-gray-400 ml-auto">{showHistory ? "▲ ซ่อน" : "▼ แสดง"}</span>
            </CardTitle>
          </CardHeader>
          {showHistory && (
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีประวัติ</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">#</th>
                        <th className="text-left py-2 px-2">ตั้งเวลา</th>
                        <th className="text-left py-2 px-2">เปิดจริง</th>
                        <th className="text-left py-2 px-2">ปิด</th>
                        <th className="text-left py-2 px-2">สถานะ</th>
                        <th className="text-left py-2 px-2">สร้างโดย</th>
                        <th className="text-left py-2 px-2">ปิดโดย</th>
                        <th className="text-left py-2 px-2">ที่มา</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => (
                        <tr key={h.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-2 px-2 text-gray-400">{h.id}</td>
                          <td className="py-2 px-2">{fmtDate(h.scheduledAt)}</td>
                          <td className="py-2 px-2">{fmtDate(h.activatedAt)}</td>
                          <td className="py-2 px-2">{fmtDate(h.liftedAt)}</td>
                          <td className="py-2 px-2">
                            <Badge variant="outline" className={STATUS_COLORS[h.status] || ""}>{h.status}</Badge>
                          </td>
                          <td className="py-2 px-2">{h.createdBy || "-"}</td>
                          <td className="py-2 px-2">{h.liftedBy || "-"}</td>
                          <td className="py-2 px-2">
                            <Badge variant="outline" className={h.source === "clone_database" ? "bg-purple-50 text-purple-700" : "bg-gray-50 text-gray-600"}>
                              {h.source === "clone_database" ? "Clone DB" : "Manual"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    </PlatformLayout>
  );
}
