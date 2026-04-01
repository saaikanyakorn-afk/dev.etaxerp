import { useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import {
  Settings2, Loader2, ArrowLeft, CheckCircle2, AlertCircle, XCircle,
  Calendar, Clock, AlertTriangle, Lock, Unlock, Shield, Save,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

const THAI_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
function fmt(val: number) { return val.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function PeriodClosing() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [year, setYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState(String(currentMonth));
  const [showDeadlineSetting, setShowDeadlineSetting] = useState(false);
  const [deadlineInput, setDeadlineInput] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);

  const { data: statusData, isLoading: statusLoading } = useQuery<any>({
    queryKey: ["/api/accounting-mgmt/period-closing/status", companyId, year],
    queryFn: () => apiRequest("GET", `/api/accounting-mgmt/period-closing/status?companyId=${companyId}&year=${year}`).then(r => r.json()),
    enabled: !!companyId,
  });

  const { data: checklist, isLoading: checklistLoading, refetch: refetchChecklist } = useQuery<any>({
    queryKey: ["/api/accounting-mgmt/period-closing/checklist", companyId, year, selectedMonth],
    queryFn: () => apiRequest("GET", `/api/accounting-mgmt/period-closing/checklist?companyId=${companyId}&year=${year}&month=${selectedMonth}`).then(r => r.json()),
    enabled: !!companyId && selectedMonth !== "0",
  });

  const { data: preview, isLoading: previewLoading, refetch: refetchPreview } = useQuery<any>({
    queryKey: ["/api/accounting-mgmt/period-closing/preview", companyId, year, selectedMonth],
    queryFn: async () => {
      const params = new URLSearchParams({ companyId: String(companyId), year });
      if (selectedMonth !== "0") params.set("month", selectedMonth);
      const res = await fetch(`/api/accounting-mgmt/period-closing/preview?${params}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!companyId && selectedMonth !== "0",
  });

  const executeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/accounting-mgmt/period-closing/execute", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({
          companyId, year: Number(year), month: Number(selectedMonth),
          incomeExpenseItems: preview?.incomeExpenseItems, netIncome: preview?.netIncome,
          retainedEarningsAccountId: preview?.retainedEarningsAccount?.id,
        }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: (result) => {
      toast({ title: "สำเร็จ", description: result.message });
      setConfirmClose(false);
      qc.invalidateQueries({ queryKey: ["/api/accounting-mgmt/period-closing/status"] });
      qc.invalidateQueries({ queryKey: ["/api/accounting-mgmt/period-closing/checklist"] });
      refetchPreview();
      refetchChecklist();
    },
    onError: (err: any) => { toast({ title: "ผิดพลาด", description: err.message, variant: "destructive" }); },
  });

  const deadlineMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/accounting-mgmt/period-closing/deadline", {
      companyId, closingDeadlineDays: Number(deadlineInput),
    }),
    onSuccess: () => {
      toast({ title: "บันทึกสำเร็จ", description: `กำหนดปิดงวดภายใน ${deadlineInput} วันหลังสิ้นเดือน` });
      setShowDeadlineSetting(false);
      qc.invalidateQueries({ queryKey: ["/api/accounting-mgmt/period-closing/status"] });
      qc.invalidateQueries({ queryKey: ["/api/accounting-mgmt/period-closing/checklist"] });
    },
    onError: (err: any) => { toast({ title: "ผิดพลาด", description: err.message, variant: "destructive" }); },
  });

  const periodLabel = `เดือน${THAI_MONTHS[Number(selectedMonth) - 1]} ${Number(year) + 543}`;
  const failedChecks = checklist?.checks?.filter((c: any) => !c.passed) || [];

  function getStatusIcon(status: string) {
    if (status === "closed") return <Lock className="h-4 w-4 text-green-600" />;
    if (status === "overdue") return <AlertTriangle className="h-4 w-4 text-red-500" />;
    if (status === "warning") return <Clock className="h-4 w-4 text-yellow-500" />;
    return <Unlock className="h-4 w-4 text-gray-400" />;
  }

  function getStatusBadge(status: string) {
    if (status === "closed") return <Badge className="bg-green-100 text-green-800 text-xs">ปิดแล้ว</Badge>;
    if (status === "overdue") return <Badge className="bg-red-100 text-red-800 text-xs">เกินกำหนด</Badge>;
    if (status === "warning") return <Badge className="bg-yellow-100 text-yellow-800 text-xs">ใกล้กำหนด</Badge>;
    return <Badge variant="secondary" className="text-xs">เปิดอยู่</Badge>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/accounting-mgmt")} data-testid="btn-back">
              <ArrowLeft className="h-4 w-4 mr-1" /> กลับ
            </Button>
            <Shield className="h-5 w-5 text-[#03c9d7]" />
            <h1 className="text-xl font-heading font-bold">ปิดงวดบัญชี</h1>
          </div>
          <div className="flex items-center gap-2">
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-32" data-testid="select-year"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => (
                  <SelectItem key={y} value={String(y)}>{y + 543}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => { setDeadlineInput(String(statusData?.deadlineDays || 15)); setShowDeadlineSetting(true); }} data-testid="btn-deadline-setting">
              <Settings2 className="h-4 w-4 mr-1" /> กำหนดวันปิดงวด
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-[#03c9d7]" />
                ภาพรวมงวด ปี {Number(year) + 543}
              </CardTitle>
              {statusData && (
                <span className="text-sm text-muted-foreground">
                  กำหนดปิด: ภายในวันที่ {statusData.deadlineDays} ของเดือนถัดไป
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {statusLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {statusData?.months?.map((m: any) => (
                  <button
                    key={m.month}
                    onClick={() => setSelectedMonth(String(m.month))}
                    className={`rounded-lg border p-3 text-left transition-all hover:shadow-md cursor-pointer ${
                      String(m.month) === selectedMonth ? "ring-2 ring-[#03c9d7] border-[#03c9d7]" : ""
                    } ${m.status === "closed" ? "bg-green-50 border-green-200" :
                        m.status === "overdue" ? "bg-red-50 border-red-200" :
                        m.status === "warning" ? "bg-yellow-50 border-yellow-200" :
                        "bg-white border-gray-200"}`}
                    data-testid={`btn-month-${m.month}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold">{THAI_MONTHS[m.month - 1].slice(0, 3)}.</span>
                      {getStatusIcon(m.status)}
                    </div>
                    {getStatusBadge(m.status)}
                    {m.daysRemaining !== null && m.status !== "closed" && (
                      <p className={`text-xs mt-1 ${m.daysRemaining < 0 ? "text-red-500" : m.daysRemaining <= 3 ? "text-yellow-600" : "text-muted-foreground"}`}>
                        {m.daysRemaining < 0 ? `เกิน ${Math.abs(m.daysRemaining)} วัน` : `เหลือ ${m.daysRemaining} วัน`}
                      </p>
                    )}
                    {m.status === "closed" && m.closedAt && (
                      <p className="text-xs text-green-600 mt-1">
                        {new Date(m.closedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedMonth !== "0" && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-[#03c9d7]" />
                    Checklist ก่อนปิดงวด — {periodLabel}
                  </CardTitle>
                  {checklist && !checklist.alreadyClosed && (
                    <Badge className={checklist.allPassed ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                      ผ่าน {checklist.passedCount}/{checklist.totalCount}
                    </Badge>
                  )}
                </div>
                {checklist?.deadline && !checklist.alreadyClosed && (
                  <div className={`text-sm mt-1 flex items-center gap-1 ${checklist.deadline.overdue ? "text-red-600 font-medium" : checklist.deadline.daysRemaining <= 3 ? "text-yellow-600" : "text-muted-foreground"}`}>
                    <Clock className="h-3.5 w-3.5" />
                    กำหนดปิด: {new Date(checklist.deadline.deadlineDate).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}
                    {checklist.deadline.overdue ? ` (เกินกำหนด ${Math.abs(checklist.deadline.daysRemaining)} วัน)` :
                     ` (เหลืออีก ${checklist.deadline.daysRemaining} วัน)`}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {checklistLoading ? (
                  <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : checklist?.alreadyClosed ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                    <Lock className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800">งวด{periodLabel} ปิดแล้ว</p>
                      {checklist.closedAt && <p className="text-sm text-green-600">ปิดเมื่อ {new Date(checklist.closedAt).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}</p>}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {checklist?.checks?.map((check: any) => (
                      <div key={check.key} className={`flex items-center gap-3 p-3 rounded-lg border ${check.passed ? "bg-green-50/50 border-green-100" : "bg-red-50/50 border-red-100"}`} data-testid={`check-${check.key}`}>
                        {check.passed ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${check.passed ? "text-green-800" : "text-red-800"}`}>{check.label}</p>
                          <p className={`text-xs ${check.passed ? "text-green-600" : "text-red-500"}`}>{check.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {preview && !preview.alreadyClosed && selectedMonth !== "0" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">สรุปการปิดงวด — {periodLabel}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-green-50 rounded-lg p-4 text-center">
                        <p className="text-sm text-muted-foreground">รายได้รวม</p>
                        <p className="text-xl font-bold text-green-600">{fmt(preview.totalIncome)}</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-4 text-center">
                        <p className="text-sm text-muted-foreground">ค่าใช้จ่ายรวม</p>
                        <p className="text-xl font-bold text-red-600">{fmt(preview.totalExpense)}</p>
                      </div>
                      <div className={`${preview.netIncome >= 0 ? "bg-blue-50" : "bg-red-50"} rounded-lg p-4 text-center`}>
                        <p className="text-sm text-muted-foreground">กำไร(ขาดทุน)สุทธิ</p>
                        <p className={`text-xl font-bold ${preview.netIncome >= 0 ? "text-blue-600" : "text-red-600"}`}>{fmt(preview.netIncome)}</p>
                      </div>
                    </div>

                    {preview.retainedEarningsAccount && (
                      <p className="text-sm text-muted-foreground">โอนเข้า: {preview.retainedEarningsAccount.code} {preview.retainedEarningsAccount.name}</p>
                    )}

                    {preview.incomeExpenseItems?.length > 0 && (
                      <div className="overflow-auto max-h-[300px] border rounded-lg">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-gray-50">
                            <tr className="border-b">
                              <th className="text-left p-2 font-medium">รหัส</th>
                              <th className="text-left p-2 font-medium">ชื่อบัญชี</th>
                              <th className="text-right p-2 font-medium">ยอด (Dr-Cr)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.incomeExpenseItems.map((item: any) => (
                              <tr key={item.accountId} className="border-b hover:bg-slate-50">
                                <td className="p-2 font-mono text-xs">{item.code}</td>
                                <td className="p-2">{item.name}</td>
                                <td className="p-2 text-right tabular-nums">{fmt(item.balance)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      <Button
                        onClick={() => {
                          if (failedChecks.length > 0) {
                            setConfirmClose(true);
                          } else {
                            executeMutation.mutate();
                          }
                        }}
                        disabled={executeMutation.isPending || previewLoading}
                        className="bg-[#03c9d7] hover:bg-[#02b0bc]"
                        data-testid="btn-execute"
                      >
                        {executeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Lock className="h-4 w-4 mr-1" />}
                        ปิดงวด{periodLabel}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-yellow-700">
                <AlertTriangle className="h-5 w-5" />
                ยืนยันปิดงวดแม้มีข้อเตือน
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm">งวด{periodLabel} มีรายการที่ยังไม่ผ่าน Checklist:</p>
              <div className="space-y-2">
                {failedChecks.map((c: any) => (
                  <div key={c.key} className="flex items-center gap-2 p-2 bg-red-50 rounded text-sm">
                    <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <span className="text-red-700">{c.label}: {c.detail}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                คุณยังสามารถปิดงวดได้ แต่รายการเหล่านี้จะถูกบันทึกว่ายังไม่ผ่านตอนปิด
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setConfirmClose(false)} data-testid="btn-cancel-close">ยกเลิก</Button>
                <Button onClick={() => executeMutation.mutate()} disabled={executeMutation.isPending} className="bg-yellow-600 hover:bg-yellow-700" data-testid="btn-confirm-close">
                  {executeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <AlertCircle className="h-4 w-4 mr-1" />}
                  ยืนยันปิดงวด
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showDeadlineSetting} onOpenChange={setShowDeadlineSetting}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-[#03c9d7]" />
                กำหนดวันปิดงวด
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                กำหนดจำนวนวันหลังสิ้นเดือนที่ต้องปิดงวดให้เสร็จ เช่น ถ้าตั้ง 15 วัน
                งวดเดือนมกราคมต้องปิดภายในวันที่ 15 กุมภาพันธ์
              </p>
              <div className="flex items-center gap-3">
                <Label>ปิดงวดภายใน</Label>
                <Input
                  type="number"
                  value={deadlineInput}
                  onChange={e => setDeadlineInput(e.target.value)}
                  className="w-24 text-center"
                  min={1}
                  max={60}
                  data-testid="input-deadline-days"
                />
                <span className="text-sm text-muted-foreground">วัน หลังสิ้นเดือน</span>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  ตัวอย่าง: งวดเดือนมกราคม → ต้องปิดภายในวันที่ {deadlineInput || "15"} กุมภาพันธ์
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowDeadlineSetting(false)}>ยกเลิก</Button>
                <Button onClick={() => deadlineMutation.mutate()} disabled={deadlineMutation.isPending} className="bg-[#03c9d7] hover:bg-[#02b0bc]" data-testid="btn-save-deadline">
                  {deadlineMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  บันทึก
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}