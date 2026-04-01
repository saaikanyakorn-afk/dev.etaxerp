import HRLayout from "@/components/hr-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Users, RotateCcw } from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useHrCompanyId } from "@/lib/company-context";

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getWeekDates(baseDate: Date): string[] {
  const d = new Date(baseDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    dates.push(toLocalDateStr(dd));
  }
  return dates;
}

const DAY_LABELS = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];
const DAY_LABELS_SHORT = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];

export default function ShiftSchedulePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const companyId = useHrCompanyId();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [rotationDialogOpen, setRotationDialogOpen] = useState(false);
  const [rotationWeeks, setRotationWeeks] = useState(4);
  const [rotationShiftIds, setRotationShiftIds] = useState<number[]>([]);
  const [rotationEmpIds, setRotationEmpIds] = useState<number[]>([]);
  const [selectAllEmps, setSelectAllEmps] = useState(true);

  const isAdmin = user?.role === "admin" || user?.role === "owner" || user?.role === "super_admin";

  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);
  const dateFrom = weekDates[0];
  const dateTo = weekDates[6];

  const monthDates = useMemo(() => {
    if (viewMode !== "month") return [];
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);
    const dates: string[] = [];
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      dates.push(toLocalDateStr(d));
    }
    return dates;
  }, [currentDate, viewMode]);

  const activeDateFrom = viewMode === "week" ? dateFrom : monthDates[0];
  const activeDateTo = viewMode === "week" ? dateTo : monthDates[monthDates.length - 1];

  const { data: shiftsList = [] } = useQuery<any[]>({
    queryKey: ["/api/shifts", companyId],
    queryFn: async () => {
      const r = await fetch(`/api/shifts?companyId=${companyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!companyId,
  });

  const { data: employeesList = [] } = useQuery<any[]>({
    queryKey: ["/api/employees", companyId],
    queryFn: async () => {
      const r = await fetch(`/api/employees?companyId=${companyId}`, { credentials: "include" });
      if (!r.ok) return [];
      const emps = await r.json();
      return emps.filter((e: any) => e.employmentStatus !== "resigned" && e.active !== false);
    },
    enabled: !!companyId,
  });

  const { data: assignments = [] } = useQuery<any[]>({
    queryKey: ["/api/shift-assignments", companyId, activeDateFrom, activeDateTo],
    queryFn: async () => {
      const r = await fetch(`/api/shift-assignments?companyId=${companyId}&dateFrom=${activeDateFrom}&dateTo=${activeDateTo}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!companyId && !!activeDateFrom && !!activeDateTo,
  });

  const assignmentMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const a of assignments) {
      const dateStr = typeof a.date === "string" ? a.date.slice(0, 10) : a.date;
      map.set(`${a.employeeId}-${dateStr}`, a);
    }
    return map;
  }, [assignments]);

  const shiftMap = useMemo(() => {
    const map = new Map<number, any>();
    for (const s of shiftsList) map.set(s.id, s);
    return map;
  }, [shiftsList]);

  const assignMutation = useMutation({
    mutationFn: async (data: { employeeId: number; shiftId: number | null; date: string }) => {
      if (data.shiftId === null) {
        const existing = assignmentMap.get(`${data.employeeId}-${data.date}`);
        if (existing) {
          const r = await fetch(`/api/shift-assignments/${existing.id}`, { method: "DELETE", credentials: "include" });
          if (!r.ok) throw new Error("ไม่สำเร็จ");
          return;
        }
        return;
      }
      const r = await fetch("/api/shift-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shift-assignments"] });
    },
    onError: (err: any) => toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const copyWeekMutation = useMutation({
    mutationFn: async () => {
      const prevWeekStart = new Date(weekDates[0]);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);
      const r = await fetch("/api/shift-assignments/copy-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          sourceWeekStart: toLocalDateStr(prevWeekStart),
          targetWeekStart: weekDates[0],
        }),
        credentials: "include",
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shift-assignments"] });
      toast({ title: `คัดลอกกะสำเร็จ (${data.copied} รายการ)` });
    },
    onError: (err: any) => toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const rotationMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/shift-assignments/generate-rotation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          shiftIds: rotationShiftIds,
          employeeIds: selectAllEmps ? employeesList.map((e: any) => e.id) : rotationEmpIds,
          startDate: weekDates[0],
          weeks: rotationWeeks,
        }),
        credentials: "include",
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shift-assignments"] });
      toast({ title: `สร้างกะหมุนเวียนสำเร็จ (${data.created} รายการ, ${data.weeks} สัปดาห์)` });
      setRotationDialogOpen(false);
    },
    onError: (err: any) => toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const openRotationDialog = () => {
    setRotationShiftIds(shiftsList.filter((s: any) => s.active).map((s: any) => s.id));
    setRotationEmpIds(employeesList.map((e: any) => e.id));
    setSelectAllEmps(true);
    setRotationWeeks(4);
    setRotationDialogOpen(true);
  };

  const toggleRotationShift = (id: number) => {
    setRotationShiftIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleRotationEmp = (id: number) => {
    setRotationEmpIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const navigateWeek = (dir: number) => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      if (viewMode === "week") {
        d.setDate(d.getDate() + dir * 7);
      } else {
        d.setMonth(d.getMonth() + dir);
      }
      return d;
    });
  };

  const formatDateShort = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return `${d.getDate()}`;
  };

  const formatMonthDisplay = () => {
    const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    if (viewMode === "week") {
      const startD = new Date(weekDates[0] + "T00:00:00");
      const endD = new Date(weekDates[6] + "T00:00:00");
      if (startD.getMonth() === endD.getMonth()) {
        return `${startD.getDate()} - ${endD.getDate()} ${months[startD.getMonth()]} ${startD.getFullYear() + 543}`;
      }
      return `${startD.getDate()} ${months[startD.getMonth()]} - ${endD.getDate()} ${months[endD.getMonth()]} ${endD.getFullYear() + 543}`;
    }
    return `${months[currentDate.getMonth()]} ${currentDate.getFullYear() + 543}`;
  };

  const displayDates = viewMode === "week" ? weekDates : monthDates;

  return (
    <HRLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-6 w-6" style={{ color: "#03c9d7" }} />
            <h1 className="text-2xl font-bold" data-testid="text-page-title">ตารางจัดกะทำงาน</h1>
          </div>
          <div className="flex items-center gap-2">
            <Select value={viewMode} onValueChange={(v: "week" | "month") => setViewMode(v)}>
              <SelectTrigger className="w-32" data-testid="select-view-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">รายสัปดาห์</SelectItem>
                <SelectItem value="month">รายเดือน</SelectItem>
              </SelectContent>
            </Select>
            {isAdmin && viewMode === "week" && (
              <>
                <Button variant="outline" onClick={() => copyWeekMutation.mutate()} disabled={copyWeekMutation.isPending} data-testid="button-copy-week">
                  <Copy className="mr-2 h-4 w-4" /> คัดลอกสัปดาห์ก่อน
                </Button>
                <Button variant="outline" onClick={openRotationDialog} data-testid="button-rotation">
                  <RotateCcw className="mr-2 h-4 w-4" /> กะหมุนเวียนอัตโนมัติ
                </Button>
              </>
            )}
          </div>
        </div>

        {shiftsList.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            {shiftsList.filter((s: any) => s.active).map((s: any) => (
              <div key={s.id} className="flex items-center gap-1.5 text-xs" data-testid={`shift-legend-${s.id}`}>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="font-medium">{s.name}</span>
                <span className="text-muted-foreground">({s.startTime}-{s.endTime})</span>
              </div>
            ))}
          </div>
        )}

        <Card className="shadow-sm border-none">
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigateWeek(-1)} data-testid="button-prev-period">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-bold text-lg min-w-[200px] text-center" data-testid="text-period-display">{formatMonthDisplay()}</span>
              <Button variant="ghost" size="sm" onClick={() => navigateWeek(1)} data-testid="button-next-period">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} data-testid="button-today">วันนี้</Button>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{employeesList.length} พนักงาน</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left text-xs font-bold p-3 border-b sticky left-0 bg-slate-50 z-10 min-w-[160px]">พนักงาน</th>
                    {displayDates.map((date, i) => {
                      const d = new Date(date + "T00:00:00");
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      const dayIndex = viewMode === "week" ? i : (d.getDay() + 6) % 7;
                      return (
                        <th key={date} className={`text-center text-xs font-bold p-2 border-b min-w-[90px] ${isWeekend ? "bg-red-50" : ""}`}>
                          <div>{viewMode === "week" ? DAY_LABELS[dayIndex] : DAY_LABELS_SHORT[(d.getDay() + 6) % 7]}</div>
                          <div className="text-muted-foreground font-normal">{formatDateShort(date)}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {employeesList.length > 0 ? employeesList.map((emp: any) => (
                    <tr key={emp.id} className="border-b hover:bg-slate-50/50" data-testid={`row-employee-${emp.id}`}>
                      <td className="p-3 sticky left-0 bg-white z-10 border-r">
                        <div className="text-sm font-medium" data-testid={`text-emp-name-${emp.id}`}>{emp.fullName}</div>
                        <div className="text-[10px] text-muted-foreground">{emp.position || emp.department || ""}</div>
                      </td>
                      {displayDates.map(date => {
                        const assignment = assignmentMap.get(`${emp.id}-${date}`);
                        const shift = assignment ? shiftMap.get(assignment.shiftId) : null;
                        return (
                          <td key={date} className="p-1 text-center border-r" data-testid={`cell-${emp.id}-${date}`}>
                            {isAdmin ? (
                              <Select
                                value={shift ? String(shift.id) : "none"}
                                onValueChange={(val) => {
                                  assignMutation.mutate({
                                    employeeId: emp.id,
                                    shiftId: val === "none" ? null : Number(val),
                                    date,
                                  });
                                }}
                              >
                                <SelectTrigger className="h-8 text-[11px] border-0 shadow-none justify-center" style={shift ? { backgroundColor: shift.color + "20", color: shift.color, fontWeight: 600 } : {}}>
                                  <SelectValue placeholder="-" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">
                                    <span className="text-muted-foreground">- ไม่กำหนด -</span>
                                  </SelectItem>
                                  {shiftsList.filter((s: any) => s.active).map((s: any) => (
                                    <SelectItem key={s.id} value={String(s.id)}>
                                      <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                                        <span>{s.name}</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              shift ? (
                                <Badge variant="outline" className="text-[10px] px-2" style={{ backgroundColor: shift.color + "20", color: shift.color, borderColor: shift.color + "40" }}>
                                  {shift.name}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={displayDates.length + 1} className="text-center py-12 text-muted-foreground text-sm">
                        ไม่พบพนักงาน
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={rotationDialogOpen} onOpenChange={setRotationDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-rotation-title">ตั้งค่ากะหมุนเวียนอัตโนมัติ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              ระบบจะสร้างตารางกะหมุนเวียนโดยอัตโนมัติ โดยพนักงานแต่ละคนจะสลับกะทุกสัปดาห์ตามลำดับที่เลือก
            </p>

            <div>
              <label className="text-sm font-medium">เลือกกะที่ต้องการหมุนเวียน (อย่างน้อย 2 กะ)</label>
              <div className="mt-2 space-y-2">
                {shiftsList.filter((s: any) => s.active).map((s: any) => (
                  <label key={s.id} className="flex items-center gap-2 cursor-pointer" data-testid={`rotation-shift-${s.id}`}>
                    <Checkbox
                      checked={rotationShiftIds.includes(s.id)}
                      onCheckedChange={() => toggleRotationShift(s.id)}
                    />
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-sm">{s.name} ({s.startTime} - {s.endTime})</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">พนักงาน</label>
              <div className="mt-2">
                <label className="flex items-center gap-2 cursor-pointer mb-2" data-testid="rotation-all-employees">
                  <Checkbox
                    checked={selectAllEmps}
                    onCheckedChange={(checked) => {
                      setSelectAllEmps(!!checked);
                      if (checked) setRotationEmpIds(employeesList.map((e: any) => e.id));
                    }}
                  />
                  <span className="text-sm font-medium">พนักงานทั้งหมด ({employeesList.length} คน)</span>
                </label>
                {!selectAllEmps && (
                  <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1">
                    {employeesList.map((e: any) => (
                      <label key={e.id} className="flex items-center gap-2 cursor-pointer" data-testid={`rotation-emp-${e.id}`}>
                        <Checkbox
                          checked={rotationEmpIds.includes(e.id)}
                          onCheckedChange={() => toggleRotationEmp(e.id)}
                        />
                        <span className="text-sm">{e.prefix}{e.firstName} {e.lastName}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">จำนวนสัปดาห์ (เริ่มจากสัปดาห์ปัจจุบัน)</label>
              <Input
                type="number"
                min={1}
                max={12}
                value={rotationWeeks}
                onChange={(e) => setRotationWeeks(Math.min(12, Math.max(1, Number(e.target.value))))}
                className="mt-1 w-24"
                data-testid="input-rotation-weeks"
              />
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="font-medium mb-1">ตัวอย่างการหมุนเวียน:</p>
              {rotationShiftIds.length >= 2 ? (
                <div className="space-y-0.5 text-muted-foreground">
                  {Array.from({ length: Math.min(rotationWeeks, 4) }).map((_, wi) => {
                    const selectedShifts = shiftsList.filter((s: any) => rotationShiftIds.includes(s.id));
                    const shiftIdx = wi % selectedShifts.length;
                    return (
                      <p key={wi}>สัปดาห์ {wi + 1}: พนง.คนที่ 1 → {selectedShifts[shiftIdx]?.name}, พนง.คนที่ 2 → {selectedShifts[(shiftIdx + 1) % selectedShifts.length]?.name}</p>
                    );
                  })}
                  {rotationWeeks > 4 && <p>...</p>}
                </div>
              ) : (
                <p className="text-muted-foreground">กรุณาเลือกกะอย่างน้อย 2 กะ</p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRotationDialogOpen(false)} data-testid="button-rotation-cancel">ยกเลิก</Button>
              <Button
                onClick={() => rotationMutation.mutate()}
                disabled={rotationMutation.isPending || rotationShiftIds.length < 2}
                data-testid="button-rotation-generate"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {rotationMutation.isPending ? "กำลังสร้าง..." : "สร้างตารางหมุนเวียน"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </HRLayout>
  );
}
