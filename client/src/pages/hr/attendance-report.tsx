import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import HRLayout from "@/components/hr-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Clock, Users, FileSpreadsheet, Pencil, RotateCcw, Plus } from "lucide-react";
import { useHrCompanyId } from "@/lib/company-context";
import { useToast } from "@/hooks/use-toast";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { toLocalDateStr } from "@/lib/utils";

interface AttendanceRow {
  recordId?: number;
  employeeId: number;
  employeeName: string;
  date: string;
  status: string;
  clockIn: string;
  clockOut: string;
  late: string;
  earlyLeaving: string;
  overtime: string;
  isHoliday?: boolean;
  isDayOff?: boolean;
  holidayName?: string | null;
  shiftName?: string | null;
  shiftColor?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  Present: "bg-green-100 text-green-700 border-green-200",
  Late: "bg-amber-100 text-amber-700 border-amber-200",
  Absent: "bg-red-100 text-red-700 border-red-200",
  Leave: "bg-blue-100 text-blue-700 border-blue-200",
  "Half Day": "bg-purple-100 text-purple-700 border-purple-200",
  Holiday: "bg-gray-100 text-gray-500 border-gray-200",
  "Day Off": "bg-gray-100 text-gray-500 border-gray-200",
  "Holiday OT": "bg-orange-100 text-orange-700 border-orange-200",
  "Day Off OT": "bg-cyan-100 text-cyan-700 border-cyan-200",
  "Early Leave": "bg-orange-100 text-orange-600 border-orange-200",
};

const STATUS_THAI: Record<string, string> = {
  Present: "ปกติ",
  Late: "มาสาย",
  Absent: "ขาดงาน",
  Leave: "ลา",
  "Half Day": "ครึ่งวัน",
  Holiday: "วันหยุด",
  "Day Off": "วันหยุด",
  "Holiday OT": "ทำงานวันหยุด",
  "Day Off OT": "ทำงานวันหยุด",
  "Early Leave": "ออกก่อนเวลา",
};

export default function AttendanceReport() {
  const companyId = useHrCompanyId();
  const { toast } = useToast();
  const { dateEra, dateFmt } = useDateSettings();
  const queryClient = useQueryClient();

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [dateFrom, setDateFrom] = useState(toLocalDateStr(firstOfMonth));
  const [dateTo, setDateTo] = useState(toLocalDateStr(today));
  const [editRow, setEditRow] = useState<AttendanceRow | null>(null);
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editNote, setEditNote] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const { data: user } = useQuery<any>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const r = await fetch("/api/auth/me", { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
  });
  const isAdmin = user?.role === "admin" || user?.role === "super_admin" || user?.role === "manager";

  const { data: report = [], isLoading } = useQuery<AttendanceRow[]>({
    queryKey: ["/api/attendance-report", dateFrom, dateTo],
    queryFn: async () => {
      const res = await fetch(`/api/attendance-report?dateFrom=${dateFrom}&dateTo=${dateTo}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!dateFrom && !!dateTo,
  });

  const editMutation = useMutation({
    mutationFn: async (data: { id: number; checkIn?: string; checkOut?: string; clearCheckOut?: boolean; note?: string }) => {
      const r = await fetch(`/api/attendance/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ message: "แก้ไขไม่สำเร็จ" }));
        throw new Error(err.message);
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance-report"] });
      setEditRow(null);
      toast({ title: "แก้ไขเวลาเรียบร้อย" });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const adminCreateMutation = useMutation({
    mutationFn: async (data: { employeeId: number; date: string; checkIn?: string; checkOut?: string; note?: string }) => {
      const r = await fetch("/api/attendance/admin-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ message: "สร้างไม่สำเร็จ" }));
        throw new Error(err.message);
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance-report"] });
      setEditRow(null);
      setIsCreating(false);
      toast({ title: "เพิ่มเวลาลงเวลาเรียบร้อย" });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const handleOpenEdit = (row: AttendanceRow) => {
    setEditRow(row);
    setIsCreating(false);
    const ci = row.clockIn !== "00:00:00" ? row.clockIn.slice(0, 5) : "";
    const co = row.clockOut !== "00:00:00" ? row.clockOut.slice(0, 5) : "";
    setEditCheckIn(ci);
    setEditCheckOut(co);
    setEditNote("");
  };

  const handleOpenCreate = (row: AttendanceRow) => {
    setEditRow(row);
    setIsCreating(true);
    setEditCheckIn("");
    setEditCheckOut("");
    setEditNote("");
  };

  const handleClearCheckOut = () => {
    if (!editRow?.recordId) return;
    if (!confirm("ยืนยันล้างเวลาเช็คเอาท์? พนักงานจะสามารถกดเช็คเอาท์ใหม่ได้")) return;
    editMutation.mutate({ id: editRow.recordId, clearCheckOut: true, note: "Admin ล้างเช็คเอาท์ (เผลอกด)" });
  };

  const handleSaveEdit = () => {
    if (!editRow?.recordId) return;
    editMutation.mutate({
      id: editRow.recordId,
      checkIn: editCheckIn || undefined,
      checkOut: editCheckOut || undefined,
      note: editNote || undefined,
    });
  };

  const isNonZero = (val: string) => val && val !== "00:00:00";

  const totalLate = report.filter(r => isNonZero(r.late)).length;
  const totalEarly = report.filter(r => isNonZero(r.earlyLeaving)).length;
  const totalOt = report.filter(r => isNonZero(r.overtime)).length;

  const exportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const sorted = [...report].sort((a, b) => b.date.localeCompare(a.date));
      const wsData = [
        ["No", "Employee", "Date", "Status", "Clock In", "Clock Out", "Late", "Early Leaving", "Overtime", "Shift"],
        ...sorted.map((r, i) => [
          i + 1, r.employeeName, r.date, r.status,
          r.clockIn, r.clockOut, r.late, r.earlyLeaving, r.overtime, r.shiftName || "-",
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws["!cols"] = [
        { wch: 5 }, { wch: 25 }, { wch: 12 }, { wch: 10 },
        { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 12 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Worksheet");
      const now = new Date();
      const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
      XLSX.writeFile(wb, `Mark Attendance_${ts}.xlsx`);
      toast({ title: "ส่งออก Excel สำเร็จ" });
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = dateEra === "BE" ? d.getFullYear() + 543 : d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <HRLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-[#fb9678]" />
            <h1 className="text-xl font-semibold">รายงานลงเวลา</h1>
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">จากวันที่</label>
                <ThaiDateInput value={dateFrom} onChange={setDateFrom} dateEra={dateEra} dateFormat={dateFmt} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">ถึงวันที่</label>
                <ThaiDateInput value={dateTo} onChange={setDateTo} dateEra={dateEra} dateFormat={dateFmt} />
              </div>
              <Button
                data-testid="button-export-excel"
                onClick={exportExcel}
                disabled={report.length === 0}
                className="bg-green-600 hover:bg-green-700 text-white gap-2"
              >
                <Download className="h-4 w-4" />
                ส่งออก Excel
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">รายการทั้งหมด</p>
                <p className="text-lg font-semibold">{report.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">มาสาย</p>
                <p className="text-lg font-semibold text-amber-600">{totalLate}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">กลับก่อน</p>
                <p className="text-lg font-semibold text-red-600">{totalEarly}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ทำ OT</p>
                <p className="text-lg font-semibold text-green-600">{totalOt}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
            ) : report.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">ไม่พบข้อมูลลงเวลาในช่วงที่เลือก</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-[var(--theme-primary)] hover:bg-[var(--theme-primary)]">
                    <TableHead className="text-white text-sm font-medium w-12 text-center">No</TableHead>
                    <TableHead className="text-white text-sm font-medium">พนักงาน</TableHead>
                    <TableHead className="text-white text-sm font-medium w-28">วันที่</TableHead>
                    <TableHead className="text-white text-sm font-medium w-24 text-center">สถานะ</TableHead>
                    <TableHead className="text-white text-sm font-medium w-24 text-center">เข้างาน</TableHead>
                    <TableHead className="text-white text-sm font-medium w-24 text-center">ออกงาน</TableHead>
                    <TableHead className="text-white text-sm font-medium w-24 text-center">มาสาย</TableHead>
                    <TableHead className="text-white text-sm font-medium w-28 text-center">ออกก่อน</TableHead>
                    <TableHead className="text-white text-sm font-medium w-24 text-center">OT</TableHead>
                    <TableHead className="text-white text-sm font-medium w-24 text-center">กะ</TableHead>
                    {isAdmin && <TableHead className="text-white text-sm font-medium w-16 text-center">แก้ไข</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...report].sort((a, b) => b.date.localeCompare(a.date)).map((row, idx) => (
                    <TableRow key={idx} data-testid={`row-attendance-${idx}`} className="hover:bg-slate-50/50">
                      <TableCell className="text-center text-sm">{idx + 1}</TableCell>
                      <TableCell className="text-sm font-medium">{row.employeeName}</TableCell>
                      <TableCell className="text-sm">{formatDisplayDate(row.date)}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={`${STATUS_COLORS[row.status] || "bg-slate-100 text-slate-700"} border text-xs font-normal`}>
                          {STATUS_THAI[row.status] || row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm tabular-nums">{row.clockIn}</TableCell>
                      <TableCell className="text-center text-sm tabular-nums">{row.clockOut}</TableCell>
                      <TableCell className="text-center text-sm tabular-nums">
                        <span className={isNonZero(row.late) ? "text-amber-600 font-medium" : "text-muted-foreground"}>{row.late}</span>
                      </TableCell>
                      <TableCell className="text-center text-sm tabular-nums">
                        <span className={isNonZero(row.earlyLeaving) ? "text-red-600 font-medium" : "text-muted-foreground"}>{row.earlyLeaving}</span>
                      </TableCell>
                      <TableCell className="text-center text-sm tabular-nums">
                        <span className={isNonZero(row.overtime) ? "text-green-600 font-medium" : "text-muted-foreground"}>{row.overtime}</span>
                      </TableCell>
                      <TableCell className="text-center text-sm" data-testid={`text-shift-${idx}`}>
                        {row.shiftName ? (
                          <Badge variant="outline" className="text-[10px]" style={{ backgroundColor: (row.shiftColor || "#03c9d7") + "20", color: row.shiftColor || "#03c9d7", borderColor: (row.shiftColor || "#03c9d7") + "40" }}>
                            {row.shiftName}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-center">
                          {row.recordId ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(row)}
                              data-testid={`btn-edit-attendance-${idx}`}
                              className="h-7 w-7 p-0"
                            >
                              <Pencil className="h-3.5 w-3.5 text-gray-500" />
                            </Button>
                          ) : row.status === "Absent" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenCreate(row)}
                              data-testid={`btn-add-attendance-${idx}`}
                              className="h-7 w-7 p-0"
                              title="เพิ่มเวลาย้อนหลัง"
                            >
                              <Plus className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editRow} onOpenChange={(open) => { if (!open) { setEditRow(null); setIsCreating(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isCreating ? <Plus className="h-4 w-4 text-green-600" /> : <Pencil className="h-4 w-4" />}
              {isCreating ? "เพิ่มเวลาลงเวลาย้อนหลัง" : "แก้ไขเวลาลงเวลา"}
            </DialogTitle>
          </DialogHeader>
          {editRow && (
            <div className="space-y-4">
              <div className={`rounded-lg p-3 space-y-1 ${isCreating ? "bg-red-50 border border-red-100" : "bg-gray-50"}`}>
                <p className="text-sm font-medium">{editRow.employeeName}</p>
                <p className="text-xs text-muted-foreground">วันที่ {formatDisplayDate(editRow.date)}</p>
                {isCreating && (
                  <Badge className="bg-red-100 text-red-700 border-red-200 text-xs mt-1">ขาดงาน — ยังไม่มีบันทึกลงเวลา</Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">เวลาเข้างาน {isCreating && <span className="text-red-500">*</span>}</Label>
                  <Input
                    type="time"
                    value={editCheckIn}
                    onChange={(e) => setEditCheckIn(e.target.value)}
                    data-testid="input-edit-checkin"
                  />
                </div>
                <div>
                  <Label className="text-sm">เวลาออกงาน</Label>
                  <Input
                    type="time"
                    value={editCheckOut}
                    onChange={(e) => setEditCheckOut(e.target.value)}
                    data-testid="input-edit-checkout"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm">หมายเหตุ</Label>
                <Input
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder={isCreating ? "เหตุผล เช่น ลืมเช็คอิน, ระบบขัดข้อง" : "เหตุผลในการแก้ไข"}
                  data-testid="input-edit-note"
                />
              </div>

              <div className="flex gap-2">
                {isCreating ? (
                  <Button
                    onClick={() => {
                      if (!editCheckIn) {
                        toast({ title: "กรุณาระบุเวลาเข้างาน", variant: "destructive" });
                        return;
                      }
                      adminCreateMutation.mutate({
                        employeeId: editRow.employeeId,
                        date: editRow.date,
                        checkIn: editCheckIn || undefined,
                        checkOut: editCheckOut || undefined,
                        note: editNote || undefined,
                      });
                    }}
                    className="flex-1 bg-[#05b187] hover:bg-[#049573]"
                    disabled={adminCreateMutation.isPending || !editCheckIn}
                    data-testid="btn-save-create-attendance"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {adminCreateMutation.isPending ? "กำลังบันทึก..." : "เพิ่มเวลาลงเวลา"}
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleClearCheckOut}
                      variant="outline"
                      className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                      disabled={editMutation.isPending || editRow.clockOut === "00:00:00"}
                      data-testid="btn-clear-checkout"
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      ล้างเช็คเอาท์
                    </Button>
                    <Button
                      onClick={handleSaveEdit}
                      className="flex-1 bg-[#05b187] hover:bg-[#049573]"
                      disabled={editMutation.isPending}
                      data-testid="btn-save-edit-attendance"
                    >
                      บันทึกการแก้ไข
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </HRLayout>
  );
}
