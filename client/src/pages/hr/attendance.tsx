import HRLayout from "@/components/hr-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Play, Square, Coffee, History, CalendarDays, CheckCircle, XCircle, Loader2, Fingerprint, Upload } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useHrCompanyId } from "@/lib/company-context";
import { Link } from "wouter";
import { formatDate } from "@/lib/format";
import { toLocalDateStr } from "@/lib/utils";
import BirthdayPopup from "@/components/birthday-popup";
import AnniversaryPopup from "@/components/anniversary-popup";

import { useDateSettings } from "@/hooks/use-date-settings";
export default function HRAttendance() {
  const [time, setTime] = useState(new Date());
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [gpsError, setGpsError] = useState("");
  const [showBirthday, setShowBirthday] = useState(false);
  const [birthdayName, setBirthdayName] = useState("");
  const [showAnniversary, setShowAnniversary] = useState(false);
  const [anniversaryName, setAnniversaryName] = useState("");
  const [anniversaryYears, setAnniversaryYears] = useState(0);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const companyId = useHrCompanyId();

  const { data: companyGps } = useQuery<any>({
    queryKey: ["/api/companies", companyId, "gps"],
    queryFn: async () => {
      if (!companyId) return null;
      const r = await fetch(`/api/companies/${companyId}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!companyId,
  });

  const isGpsRequired = companyGps?.gpsRequired === true;

  const requestGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus("error");
      setGpsError("เบราว์เซอร์ไม่รองรับ GPS");
      return;
    }
    setGpsStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsStatus("success");
      },
      (err) => {
        setGpsStatus("error");
        setGpsError(err.code === 1 ? "กรุณาอนุญาตการเข้าถึงตำแหน่ง" : "ไม่สามารถดึงตำแหน่งได้");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    if (isGpsRequired) requestGps();
  }, [isGpsRequired, requestGps]);

  const { dateEra, dateFmt } = useDateSettings();
  const { data: docSettings } = useQuery<any>({
    queryKey: ["/api/document-settings", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const res = await fetch(`/api/document-settings?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
  });
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: employee } = useQuery<any>({
    queryKey: ["/api/employees", companyId, user?.id],
    queryFn: async () => {
      const r = await fetch(`/api/employees?companyId=${companyId}`, { credentials: "include" });
      if (!r.ok) return null;
      const employees = await r.json();
      if (!Array.isArray(employees)) return null;
      return employees.find((e: any) => e.userId === user?.id) || employees[0];
    },
    enabled: !!user && !!companyId,
  });

  const { data: scheduleData } = useQuery<any[]>({
    queryKey: ["/api/work-schedules", companyId],
    queryFn: async () => {
      const url = companyId ? `/api/work-schedules?companyId=${companyId}` : "/api/work-schedules";
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user,
  });
  const schedule = (scheduleData || []).find((s: any) => s.isDefault) || (scheduleData || [])[0];

  const employeeId = employee?.id;
  const todayStr = toLocalDateStr(new Date());

  const { data: todayShiftAssignment } = useQuery<any>({
    queryKey: ["/api/shift-assignments", companyId, employeeId, todayStr],
    queryFn: async () => {
      const r = await fetch(`/api/shift-assignments?companyId=${companyId}&dateFrom=${todayStr}&dateTo=${todayStr}`, { credentials: "include" });
      if (!r.ok) return null;
      const all = await r.json();
      return all.find((a: any) => a.employeeId === employeeId) || null;
    },
    enabled: !!companyId && !!employeeId,
  });

  const { data: shiftsList = [] } = useQuery<any[]>({
    queryKey: ["/api/shifts", companyId],
    queryFn: async () => {
      const r = await fetch(`/api/shifts?companyId=${companyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!companyId,
  });

  const todayShift = todayShiftAssignment ? shiftsList.find((s: any) => s.id === todayShiftAssignment.shiftId) : null;

  const { data: attendanceData } = useQuery<any[]>({
    queryKey: ["/api/attendance", employeeId],
    queryFn: async () => {
      const r = await fetch(`/api/attendance/${employeeId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!employeeId,
  });
  const attendanceRecords = Array.isArray(attendanceData) ? attendanceData : [];

  const { data: otData } = useQuery<any[]>({
    queryKey: ["/api/ot", employeeId],
    queryFn: async () => {
      const r = await fetch(`/api/ot/${employeeId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!employeeId,
  });
  const otRecords = Array.isArray(otData) ? otData : [];

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = toLocalDateStr(yesterdayDate);

  const todayRecord = attendanceRecords.find((r: any) => r.date === todayStr);
  const yesterdayOpenRecord = attendanceRecords.find((r: any) => r.date === yesterdayStr && r.checkIn && !r.checkOut);
  const activeRecord = yesterdayOpenRecord || todayRecord;

  const currentStatus = yesterdayOpenRecord ? "clocked_in" : todayRecord?.checkOut ? "checked_out" : todayRecord?.checkIn ? "clocked_in" : "idle";

  const [retryInfo, setRetryInfo] = useState<{ attempt: number; action: string } | null>(null);

  const fetchWithRetry = async (url: string, options: RequestInit, actionLabel: string) => {
    const MAX_ATTEMPTS = 5;
    const DELAY_MS = 5000;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        if (attempt > 1) setRetryInfo({ attempt, action: actionLabel });
        const r = await fetch(url, options);

        if (r.status === 503 && attempt < MAX_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
          continue;
        }
        if (!r.ok) {
          const d = await r.json().catch(() => ({ message: "เกิดข้อผิดพลาด" }));
          setRetryInfo(null);
          throw new Error(d.message);
        }
        setRetryInfo(null);
        return r.json();
      } catch (err: any) {
        if (err.message?.includes("Failed to fetch") && attempt < MAX_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
          continue;
        }
        setRetryInfo(null);
        throw err;
      }
    }
    setRetryInfo(null);
    throw new Error("ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
  };

  const checkInMutation = useMutation({
    mutationFn: () => fetchWithRetry("/api/attendance/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, lat: gpsLocation?.lat, lng: gpsLocation?.lng }),
      credentials: "include",
    }, "เช็คอิน"),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance", employeeId] });
      toast({ title: "ลงเวลาเข้างานสำเร็จ", variant: "success" as any });
      try {
        const [bRes, aRes] = await Promise.all([
          fetch(`/api/attendance/birthday-check/${employeeId}`, { credentials: "include" }),
          fetch(`/api/attendance/anniversary-check/${employeeId}`, { credentials: "include" }),
        ]);
        let birthdayShown = false;
        if (bRes.ok) {
          const data = await bRes.json();
          if (data.isBirthday) {
            setBirthdayName(data.employeeName || "");
            setTimeout(() => setShowBirthday(true), 800);
            birthdayShown = true;
          }
        }
        if (aRes.ok) {
          const data = await aRes.json();
          if (data.isAnniversary && data.years >= 1) {
            setAnniversaryName(data.employeeName || "");
            setAnniversaryYears(data.years);
            setTimeout(() => setShowAnniversary(true), birthdayShown ? 2000 : 800);
          }
        }
      } catch {}
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: () => fetchWithRetry("/api/attendance/check-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, lat: gpsLocation?.lat, lng: gpsLocation?.lng }),
      credentials: "include",
    }, "เช็คเอาท์"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance", employeeId] });
      toast({ title: "ลงเวลาออกงานสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const otTotal = otRecords.reduce((sum: number, r: any) => sum + Number(r.hours || 0), 0);
  const otAmount = otRecords.reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);
  const otPending = otRecords.filter((r: any) => r.status === "pending").length;

  return (
    <HRLayout>
      <BirthdayPopup open={showBirthday} onClose={() => setShowBirthday(false)} employeeName={birthdayName} />
      <AnniversaryPopup open={showAnniversary} onClose={() => setShowAnniversary(false)} employeeName={anniversaryName} years={anniversaryYears} />
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Clock className="h-6 w-6" style={{ color: "#03c9d7" }} />
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-hr-title">ระบบลงเวลาเข้า-ออกงาน</h1>
        </div>

        {(schedule || todayShift) && (
          <div className="flex items-center gap-4 p-3 rounded-lg bg-blue-50 border border-blue-100 flex-wrap" data-testid="info-work-schedule">
            {todayShift ? (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: todayShift.color }} />
                  <span className="text-blue-600 font-medium">กะวันนี้:</span>
                  <span className="font-bold" style={{ color: todayShift.color }}>{todayShift.name}</span>
                </div>
                <div className="w-px h-4 bg-blue-200" />
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-blue-600 font-medium">เวลา:</span>
                  <span className="font-bold text-blue-800">{todayShift.startTime} - {todayShift.endTime}</span>
                </div>
                <div className="w-px h-4 bg-blue-200" />
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-blue-600 font-medium">สายเกิน:</span>
                  <span className="font-bold text-amber-600">{todayShift.lateThresholdMinutes} นาที</span>
                </div>
              </>
            ) : schedule ? (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-blue-600 font-medium">เวลาทำงาน:</span>
                  <span className="font-bold text-blue-800">{schedule.startTime} - {schedule.endTime}</span>
                </div>
                <div className="w-px h-4 bg-blue-200" />
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-blue-600 font-medium">พักเที่ยง:</span>
                  <span className="font-bold text-blue-800">{schedule.breakStartTime} - {schedule.breakEndTime}</span>
                </div>
                <div className="w-px h-4 bg-blue-200" />
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-blue-600 font-medium">สายเกิน:</span>
                  <span className="font-bold text-amber-600">{schedule.lateThresholdMinutes} นาที</span>
                </div>
              </>
            ) : null}
            <Link href="/hr/work-schedule" className="ml-auto text-xs text-blue-500 hover:underline" data-testid="link-schedule-settings">ตั้งค่า</Link>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-12">
          <Card className="md:col-span-4 border-none shadow-lg text-white overflow-hidden relative" style={{ background: "#03c9d7" }}>
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-lg font-medium opacity-80 uppercase tracking-widest">Digital Check-in</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center py-6">
              <div className="text-5xl font-black mb-2 tracking-tighter" data-testid="text-clock">
                {time.toLocaleTimeString('th-TH', { hour12: false })}
              </div>
              <p className="text-white/80 text-sm mb-4">
                {formatDate(time.toISOString(), dateEra, dateFmt)}
              </p>

              {employee && (
                <div className="mb-6 text-center">
                  <p className="text-white font-medium">{employee.fullName}</p>
                  <p className="text-white/70 text-xs">{employee.employeeCode} · {employee.position}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 w-full">
                {currentStatus === "idle" ? (
                  <Button 
                    onClick={() => checkInMutation.mutate()}
                    disabled={checkInMutation.isPending || !employeeId || (isGpsRequired && gpsStatus !== "success")}
                    className="col-span-2 bg-white hover:bg-gray-50 h-16 text-lg font-bold rounded-2xl shadow-xl"
                    style={{ color: "#03c9d7" }}
                    data-testid="button-check-in"
                  >
                    <Play className="mr-2 h-6 w-6 fill-current" /> {checkInMutation.isPending ? (retryInfo ? `เชื่อมต่อฐานข้อมูล... (${retryInfo.attempt}/5)` : "กำลังบันทึก...") : "ลงเวลาเข้างาน"}
                  </Button>
                ) : currentStatus === "clocked_in" ? (
                  <Button 
                    onClick={() => checkOutMutation.mutate()}
                    disabled={checkOutMutation.isPending || (isGpsRequired && gpsStatus !== "success")}
                    className="col-span-2 bg-rose-500 text-white hover:bg-rose-600 h-16 font-bold rounded-2xl border-none"
                    data-testid="button-check-out"
                  >
                    <Square className="mr-2 h-5 w-5 fill-current" /> {checkOutMutation.isPending ? (retryInfo ? `เชื่อมต่อฐานข้อมูล... (${retryInfo.attempt}/5)` : "กำลังบันทึก...") : "ลงเวลาออกงาน"}
                  </Button>
                ) : (
                  <div className="col-span-2 text-center py-4 bg-white/10 rounded-2xl">
                    <p className="text-white/80 text-sm">ลงเวลาเข้า-ออกงานเรียบร้อยแล้ววันนี้</p>
                    {todayRecord && (
                      <p className="text-white/70 text-xs mt-1">
                        เข้า: {new Date(todayRecord.checkIn).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} · 
                        ออก: {new Date(todayRecord.checkOut).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} · 
                        รวม: {todayRecord.totalHours} ชม.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {activeRecord && currentStatus === "clocked_in" && (
                <div className="mt-4 bg-white/10 rounded-xl p-3 w-full text-center">
                  <p className="text-xs text-white/70">เข้างานเมื่อ {new Date(activeRecord.checkIn).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</p>
                  {yesterdayOpenRecord && <p className="text-xs text-yellow-300 mt-0.5">กะข้ามวัน (เมื่อวาน)</p>}
                  <Badge className={activeRecord.status === "late" ? "bg-amber-400 text-amber-900 mt-1" : "bg-emerald-400 text-emerald-900 mt-1"}>
                    {activeRecord.status === "late" ? "สาย" : "ปกติ"}
                  </Badge>
                </div>
              )}

              <div className="mt-8 w-full space-y-2">
                {isGpsRequired ? (
                  <div className="flex items-center gap-2 text-[11px]">
                    {gpsStatus === "loading" && <><Loader2 className="h-3 w-3 animate-spin" /><span className="opacity-70">กำลังดึงตำแหน่ง GPS...</span></>}
                    {gpsStatus === "success" && gpsLocation && (
                      <><CheckCircle className="h-3 w-3 text-emerald-300" /><span className="opacity-80">ตำแหน่ง: {gpsLocation.lat.toFixed(5)}, {gpsLocation.lng.toFixed(5)}</span></>
                    )}
                    {gpsStatus === "error" && (
                      <div className="flex items-center gap-2">
                        <XCircle className="h-3 w-3 text-rose-300" />
                        <span className="text-rose-200">{gpsError}</span>
                        <button onClick={requestGps} className="underline text-white/80 text-[10px]" data-testid="button-gps-retry">ลองใหม่</button>
                      </div>
                    )}
                    {gpsStatus === "idle" && <><MapPin className="h-3 w-3 opacity-50" /><span className="opacity-50">รอดึงตำแหน่ง GPS</span></>}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[11px] opacity-70">
                    <MapPin className="h-3 w-3" />
                    <span>ลงเวลาได้จากทุกที่ (ไม่ล็อก GPS)</span>
                  </div>
                )}
                {isGpsRequired && companyGps?.gpsRadiusMeters && (
                  <div className="text-[10px] opacity-50 text-center">
                    รัศมีอนุญาต: {companyGps.gpsRadiusMeters} เมตรจากสำนักงาน
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-8 shadow-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">จัดการการทำโอที (OT Management)</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">คำนวณค่าล่วงเวลาอัตโนมัติตามระเบียบสำนักงาน</p>
              </div>
              <Link href="/hr/ot">
                <Button variant="outline" size="sm" className="border-[#03c9d7] text-[#03c9d7] hover:bg-cyan-50" data-testid="button-ot-cutoff">
                  <CalendarDays className="mr-2 h-4 w-4" /> ตั้งค่าตัดรอบ OT
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">OT สะสมเดือนนี้</p>
                    <p className="text-2xl font-bold" data-testid="text-ot-hours" style={{ color: "#03c9d7" }}>{otTotal.toFixed(1)} ชม.</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">ประมาณการค่า OT</p>
                    <p className="text-2xl font-bold" data-testid="text-ot-amount" style={{ color: "#03c9d7" }}>฿{otAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">สถานะการอนุมัติ</p>
                    <p className="text-2xl font-bold text-amber-600" data-testid="text-ot-pending">{otPending > 0 ? `${otPending} รอตรวจ` : "เรียบร้อย"}</p>
                  </div>
                </div>

                <div className="border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-[11px] font-bold">วันที่</TableHead>
                        <TableHead className="text-[11px] font-bold">ประเภท</TableHead>
                        <TableHead className="text-[11px] font-bold text-right">จำนวนชม.</TableHead>
                        <TableHead className="text-[11px] font-bold text-right">จำนวนเงิน</TableHead>
                        <TableHead className="text-[11px] font-bold text-center">สถานะ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {otRecords.length > 0 ? otRecords.map((log: any) => (
                        <TableRow key={log.id} className="text-[11px]" data-testid={`row-ot-${log.id}`}>
                          <TableCell>{log.date}</TableCell>
                          <TableCell>{Number(log.rate) === 1.5 ? "1.5 เท่า" : `${log.rate} เท่า (วันหยุด)`}</TableCell>
                          <TableCell className="text-right font-bold">{Number(log.hours).toFixed(1)}</TableCell>
                          <TableCell className="text-right font-bold" style={{ color: "#03c9d7" }}>฿{Number(log.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={log.status === "approved" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"}>
                              {log.status === "approved" ? "อนุมัติแล้ว" : "รออนุมัติ"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-xs">
                            ยังไม่มีรายการ OT ในเดือนนี้
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/hr/scanner-mapping">
            <Button variant="outline" size="sm" className="border-[#03c9d7] text-[#03c9d7] hover:bg-cyan-50" data-testid="link-scanner-mapping">
              <Fingerprint className="mr-2 h-4 w-4" /> จับคู่เครื่องสแกน
            </Button>
          </Link>
          <Link href="/hr/scanner-import">
            <Button variant="outline" size="sm" className="border-[#03c9d7] text-[#03c9d7] hover:bg-cyan-50" data-testid="link-scanner-import">
              <Upload className="mr-2 h-4 w-4" /> นำเข้าข้อมูลสแกน
            </Button>
          </Link>
        </div>

        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5 text-slate-400" /> ประวัติการเข้างานล่าสุด
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-xs">วันที่</TableHead>
                    <TableHead className="text-xs">เวลาเข้า</TableHead>
                    <TableHead className="text-xs">เวลาออก</TableHead>
                    <TableHead className="text-xs">ชั่วโมงงาน</TableHead>
                    <TableHead className="text-xs">สถานะ</TableHead>
                    <TableHead className="text-xs">แหล่งที่มา</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceRecords.length > 0 ? attendanceRecords.map((row: any) => (
                    <TableRow key={row.id} className="text-xs" data-testid={`row-attendance-${row.id}`}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell className="">
                        {row.checkIn ? new Date(row.checkIn).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : "-"}
                      </TableCell>
                      <TableCell className="">
                        {row.checkOut ? new Date(row.checkOut).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : "-"}
                      </TableCell>
                      <TableCell>{row.totalHours ? `${Number(row.totalHours).toFixed(1)} ชม.` : "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={row.status === "present" ? "bg-[#e5f9fa] border-[#03c9d7]/30" : "bg-rose-50 text-rose-600"} style={row.status === "present" ? { color: "#03c9d7" } : undefined}>
                          {row.status === "present" ? "ปกติ" : row.status === "late" ? "สาย" : row.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {row.source === "gps" ? "GPS" : row.source === "scanner" ? "สแกน" : row.source === "webhook" ? "Webhook" : "ลงเอง"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-xs">
                        ยังไม่มีประวัติการเข้างาน กดปุ่ม "ลงเวลาเข้างาน" เพื่อเริ่มต้น
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
             </Table>
          </CardContent>
        </Card>
      </div>
    </HRLayout>
  );
}
