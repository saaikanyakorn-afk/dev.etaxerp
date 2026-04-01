import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import { apiRequest } from "@/lib/queryClient";
import {
  Brain, Plus, Play, CheckCircle2, Clock, Trash2, Eye, TrendingUp,
  Award, AlertCircle, Loader2, ChevronDown, ChevronUp, ChevronRight, Star,
  DollarSign, Users, BarChart3, Sparkles, ThumbsUp, ArrowLeft,
  Pencil, Save, Wallet
} from "lucide-react";
import { toLocalDateStr } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { useDateSettings } from "@/hooks/use-date-settings";
import ThaiDateInput from "@/components/thai-date-input";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel
} from "@/components/ui/alert-dialog";

function fmt(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return n.toFixed(1) + "%";
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "ร่าง", color: "bg-slate-100 text-slate-700 border-slate-200", icon: Clock },
  evaluated: { label: "ประเมินแล้ว", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Brain },
  approved: { label: "อนุมัติแล้ว", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  salary_applied: { label: "ปรับเงินเดือนแล้ว", color: "bg-cyan-100 text-cyan-700 border-cyan-200", icon: TrendingUp },
  bonus_applied: { label: "จ่ายโบนัสแล้ว", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Award },
  applied: { label: "ดำเนินการครบ", color: "bg-purple-100 text-purple-700 border-purple-200", icon: DollarSign },
};

const GRADE_COLORS: Record<string, string> = {
  "A+": "bg-emerald-500 text-white",
  "A": "bg-emerald-400 text-white",
  "B+": "bg-blue-500 text-white",
  "B": "bg-blue-400 text-white",
  "C+": "bg-amber-500 text-white",
  "C": "bg-amber-400 text-white",
  "D": "bg-red-500 text-white",
  "N/A": "bg-gray-400 text-white",
};

export default function Performance() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { dateEra, dateFmt } = useDateSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [activeTab, setActiveTab] = useState<"periods" | "create">("periods");
  const [viewingPeriodId, setViewingPeriodId] = useState<number | null>(null);
  const [expandedResult, setExpandedResult] = useState<number | null>(null);

  const [newPeriod, setNewPeriod] = useState({
    name: "",
    startDate: "",
    endDate: toLocalDateStr(new Date()),
    salaryBudget: "",
    bonusBudget: "",
  });

  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; type: string; periodId: number | null }>({ open: false, type: "", periodId: null });
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{ increase: string; bonusMonths: string }>({ increase: "", bonusMonths: "" });

  const { data: periods = [], isLoading: loadingPeriods } = useQuery<any[]>({
    queryKey: ["/api/evaluation-periods", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const res = await fetch(`/api/evaluation-periods?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!companyId,
  });

  const { data: results = [], isLoading: loadingResults } = useQuery<any[]>({
    queryKey: ["/api/evaluation-results", viewingPeriodId],
    queryFn: async () => {
      if (!viewingPeriodId) return [];
      const res = await fetch(`/api/evaluation-results?periodId=${viewingPeriodId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!viewingPeriodId,
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/employees", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const res = await fetch(`/api/employees?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/evaluation-periods", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation-periods"] });
      toast({ title: "สร้างรอบประเมินสำเร็จ", variant: "success" as any });
      setActiveTab("periods");
      setNewPeriod({ name: "", startDate: "", endDate: toLocalDateStr(new Date()), salaryBudget: "", bonusBudget: "" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const runAiMutation = useMutation({
    mutationFn: async (periodId: number) => {
      const res = await apiRequest("POST", `/api/evaluation-periods/${periodId}/run-ai`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation-periods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation-results"] });
      toast({ title: "AI ประเมินเสร็จสิ้น", description: `ประเมินพนักงาน ${data.resultsCount} คน`, variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async (periodId: number) => apiRequest("POST", `/api/evaluation-periods/${periodId}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation-periods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation-results"] });
      toast({ title: "อนุมัติผลประเมินสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const applySalaryMutation = useMutation({
    mutationFn: async (periodId: number) => apiRequest("POST", `/api/evaluation-periods/${periodId}/apply-salary`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation-periods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation-results"] });
      toast({ title: "ปรับเงินเดือนสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const applyBonusMutation = useMutation({
    mutationFn: async (periodId: number) => apiRequest("POST", `/api/evaluation-periods/${periodId}/apply-bonus`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation-periods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation-results"] });
      toast({ title: "อนุมัติจ่ายโบนัสสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const updateResultMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/evaluation-results/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation-results"] });
      toast({ title: "บันทึกการแก้ไขสำเร็จ", variant: "success" as any });
      setEditingRow(null);
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const updatePeriodMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/evaluation-periods/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation-periods"] });
      toast({ title: "บันทึกงบประมาณสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (periodId: number) => apiRequest("DELETE", `/api/evaluation-periods/${periodId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation-periods"] });
      toast({ title: "ลบรอบประเมินสำเร็จ", variant: "success" as any });
      if (viewingPeriodId) setViewingPeriodId(null);
    },
  });

  const handleCreate = () => {
    if (!newPeriod.name || !newPeriod.startDate || !newPeriod.endDate) {
      toast({ title: "กรุณากรอกข้อมูลให้ครบ", variant: "destructive" });
      return;
    }
    createMutation.mutate({ ...newPeriod, companyId, status: "draft", salaryBudget: newPeriod.salaryBudget || "0", bonusBudget: newPeriod.bonusBudget || "0" });
  };

  const handleConfirmAction = () => {
    if (!confirmDialog.periodId) return;
    switch (confirmDialog.type) {
      case "runAi":
        runAiMutation.mutate(confirmDialog.periodId);
        break;
      case "approve":
        approveMutation.mutate(confirmDialog.periodId);
        break;
      case "applySalary":
        applySalaryMutation.mutate(confirmDialog.periodId);
        break;
      case "applyBonus":
        applyBonusMutation.mutate(confirmDialog.periodId);
        break;
      case "delete":
        deleteMutation.mutate(confirmDialog.periodId);
        break;
    }
    setConfirmDialog({ open: false, type: "", periodId: null });
  };

  const startEditRow = (r: any) => {
    setEditingRow(r.id);
    setEditValues({
      increase: String(r.recommendedIncrease || "0"),
      bonusMonths: String(r.bonusMonths || "0"),
    });
  };

  const handleSaveEdit = (r: any) => {
    const increase = parseFloat(editValues.increase || "0");
    const bonusM = parseFloat(editValues.bonusMonths || "0");
    const currentSalary = parseFloat(String(r.currentSalary || "0"));
    const newSalary = currentSalary * (1 + increase / 100);
    const bonusAmount = currentSalary * bonusM;
    updateResultMutation.mutate({
      id: r.id,
      data: {
        recommendedIncrease: increase.toFixed(2),
        newSalary: newSalary.toFixed(2),
        bonusMonths: bonusM.toFixed(2),
        bonusAmount: bonusAmount.toFixed(2),
      },
    });
  };

  const viewStatus = viewingPeriodId ? periods.find((p: any) => p.id === viewingPeriodId)?.status : null;
  const canEdit = viewingPeriodId && viewStatus && !["applied", "salary_applied", "bonus_applied"].includes(viewStatus);

  const viewingPeriod = periods.find((p: any) => p.id === viewingPeriodId);
  const empMap = new Map(employees.map((e: any) => [e.id, e]));

  const totalCurrentSalary = results.reduce((s: number, r: any) => s + parseFloat(String(r.currentSalary || "0")), 0);
  const totalNewSalary = results.reduce((s: number, r: any) => s + parseFloat(String(r.newSalary || "0")), 0);
  const totalBonus = results.reduce((s: number, r: any) => s + parseFloat(String(r.bonusAmount || "0")), 0);
  const avgScore = results.length > 0 ? results.reduce((s: number, r: any) => s + parseFloat(String(r.totalScore || "0")), 0) / results.length : 0;

  if (viewingPeriodId && viewingPeriod) {
    return (
      <Layout>
        <div className="space-y-4" data-testid="performance-results">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="sm" onClick={() => setViewingPeriodId(null)} data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-1" /> กลับ
            </Button>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{viewingPeriod.name}</h2>
              <p className="text-sm text-gray-500">{formatDate(viewingPeriod.startDate, dateEra, dateFmt)} - {formatDate(viewingPeriod.endDate, dateEra, dateFmt)}</p>
            </div>
            <Badge className={STATUS_MAP[viewingPeriod.status]?.color || "bg-gray-100"}>
              {STATUS_MAP[viewingPeriod.status]?.label || viewingPeriod.status}
            </Badge>
          </div>

          {results.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <Users className="w-5 h-5 mx-auto text-blue-500 mb-1" />
                  <div className="text-2xl font-bold">{results.length}</div>
                  <div className="text-xs text-gray-500">พนักงาน</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Star className="w-5 h-5 mx-auto text-amber-500 mb-1" />
                  <div className="text-2xl font-bold">{avgScore.toFixed(2)}</div>
                  <div className="text-xs text-gray-500">คะแนนเฉลี่ย</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <TrendingUp className="w-5 h-5 mx-auto text-emerald-500 mb-1" />
                  <div className="text-2xl font-bold">{fmt(totalNewSalary - totalCurrentSalary)}</div>
                  <div className="text-xs text-gray-500">เงินเดือนเพิ่ม/เดือน</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Award className="w-5 h-5 mx-auto text-purple-500 mb-1" />
                  <div className="text-2xl font-bold">{fmt(totalBonus)}</div>
                  <div className="text-xs text-gray-500">โบนัสรวม</div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {viewingPeriod.status === "draft" && (
              <Button
                onClick={() => setConfirmDialog({ open: true, type: "runAi", periodId: viewingPeriodId })}
                disabled={runAiMutation.isPending}
                className="bg-blue-500 text-white"
                data-testid="button-run-ai"
              >
                {runAiMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                {runAiMutation.isPending ? "กำลังประเมิน..." : "AI ประเมินผลงาน"}
              </Button>
            )}
            {viewingPeriod.status === "evaluated" && (
              <Button
                onClick={() => setConfirmDialog({ open: true, type: "approve", periodId: viewingPeriodId })}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                data-testid="button-approve"
              >
                <ThumbsUp className="w-4 h-4 mr-1" /> อนุมัติผลประเมิน
              </Button>
            )}
            {(viewingPeriod.status === "approved" || viewingPeriod.status === "bonus_applied") && (
              <Button
                onClick={() => setConfirmDialog({ open: true, type: "applySalary", periodId: viewingPeriodId })}
                className="bg-cyan-600 text-white hover:bg-cyan-700"
                data-testid="button-apply-salary"
              >
                <TrendingUp className="w-4 h-4 mr-1" /> ปรับเงินเดือน
              </Button>
            )}
            {(viewingPeriod.status === "approved" || viewingPeriod.status === "salary_applied") && (
              <Button
                onClick={() => setConfirmDialog({ open: true, type: "applyBonus", periodId: viewingPeriodId })}
                className="bg-amber-600 text-white hover:bg-amber-700"
                data-testid="button-apply-bonus"
              >
                <Award className="w-4 h-4 mr-1" /> จ่ายโบนัส
              </Button>
            )}
          </div>

          {loadingResults ? (
            <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
          ) : results.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <Brain className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-lg font-medium mb-1">ยังไม่มีผลประเมิน</p>
                <p className="text-sm">กดปุ่ม "AI ประเมินผลงาน" เพื่อเริ่มประเมิน</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>พนักงาน</TableHead>
                      <TableHead>ตำแหน่ง</TableHead>
                      <TableHead className="text-center">คะแนน</TableHead>
                      <TableHead className="text-center">เกรด</TableHead>
                      <TableHead className="text-right">เงินเดือนปัจจุบัน</TableHead>
                      <TableHead className="text-center">ขึ้น %</TableHead>
                      <TableHead className="text-right">เงินเดือนใหม่</TableHead>
                      <TableHead className="text-center">โบนัส (เดือน)</TableHead>
                      <TableHead className="text-right">โบนัส (บาท)</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r: any, idx: number) => {
                      const emp = empMap.get(r.employeeId);
                      const isExpanded = expandedResult === r.id;
                      const scores = (r.scores || []) as any[];
                      const metrics = (r.metricsData || {}) as any;
                      const isEditing = editingRow === r.id;
                      const editIncrease = parseFloat(editValues.increase || "0");
                      const editBonusM = parseFloat(editValues.bonusMonths || "0");
                      const editCurrentSalary = parseFloat(String(r.currentSalary || "0"));
                      const previewNewSalary = isEditing ? editCurrentSalary * (1 + editIncrease / 100) : 0;
                      const previewBonusAmt = isEditing ? editCurrentSalary * editBonusM : 0;
                      return (
                        <>{/* Fragment for result row + expanded detail */}
                          <TableRow key={r.id} className="hover:bg-gray-50" data-testid={`row-result-${r.id}`}>
                            <TableCell className="text-sm">{idx + 1}</TableCell>
                            <TableCell className="font-medium text-sm cursor-pointer" onClick={() => setExpandedResult(isExpanded ? null : r.id)}>{emp?.fullName || `#${r.employeeId}`}</TableCell>
                            <TableCell className="text-sm text-gray-600">{emp?.position || "-"}</TableCell>
                            <TableCell className="text-center">
                              <span className="font-bold text-lg">{parseFloat(String(r.totalScore || "0")).toFixed(2)}</span>
                              <span className="text-xs text-gray-400">/5</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={`${GRADE_COLORS[r.grade] || "bg-gray-400 text-white"} px-3 py-1 text-sm font-bold`}>
                                {r.grade}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-sm">{fmt(r.currentSalary)}</TableCell>
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              {isEditing ? (
                                <Input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max="100"
                                  className="w-20 h-8 text-center text-sm mx-auto"
                                  value={editValues.increase}
                                  onChange={(e) => setEditValues(prev => ({ ...prev, increase: e.target.value }))}
                                  data-testid={`input-increase-${r.id}`}
                                />
                              ) : parseFloat(String(r.recommendedIncrease || "0")) > 0 ? (
                                <span className="text-emerald-600 font-medium">+{fmtPct(r.recommendedIncrease)}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium">
                              {isEditing ? fmt(previewNewSalary) : fmt(r.newSalary)}
                            </TableCell>
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              {isEditing ? (
                                <Input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max="12"
                                  className="w-20 h-8 text-center text-sm mx-auto"
                                  value={editValues.bonusMonths}
                                  onChange={(e) => setEditValues(prev => ({ ...prev, bonusMonths: e.target.value }))}
                                  data-testid={`input-bonus-${r.id}`}
                                />
                              ) : (
                                <span>{parseFloat(String(r.bonusMonths || "0")).toFixed(1)}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium text-purple-600">
                              {isEditing ? fmt(previewBonusAmt) : fmt(r.bonusAmount)}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                {canEdit && !isEditing && (
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEditRow(r)} data-testid={`button-edit-${r.id}`}>
                                    <Pencil className="w-3.5 h-3.5 text-blue-500" />
                                  </Button>
                                )}
                                {isEditing && (
                                  <>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleSaveEdit(r)} disabled={updateResultMutation.isPending} data-testid={`button-save-${r.id}`}>
                                      <Save className="w-3.5 h-3.5 text-emerald-500" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingRow(null); setEditValues({ increase: "", bonusMonths: "" }); }} data-testid={`button-cancel-${r.id}`}>
                                      <AlertCircle className="w-3.5 h-3.5 text-gray-400" />
                                    </Button>
                                  </>
                                )}
                                {!isEditing && (
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setExpandedResult(isExpanded ? null : r.id)}>
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow key={`detail-${r.id}`}>
                              <TableCell colSpan={11} className="bg-gray-50 p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <h4 className="font-bold text-sm mb-2 flex items-center gap-1">
                                      <BarChart3 className="w-4 h-4 text-blue-500" /> คะแนนรายหัวข้อ
                                    </h4>
                                    <div className="space-y-2">
                                      {scores.map((s: any, si: number) => (
                                        <div key={si} className="flex items-center gap-2">
                                          <div className="flex-1">
                                            <div className="flex justify-between text-xs mb-0.5">
                                              <span>{s.name}</span>
                                              <span className="font-medium">{s.score}/5 ({s.weight}%)</span>
                                            </div>
                                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                              <div
                                                className={`h-full rounded-full ${s.score >= 4 ? "bg-emerald-500" : s.score >= 3 ? "bg-blue-500" : s.score >= 2 ? "bg-amber-500" : "bg-red-500"}`}
                                                style={{ width: `${(s.score / 5) * 100}%` }}
                                              />
                                            </div>
                                            <div className="text-xs text-gray-500 mt-0.5">{s.reason}</div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="space-y-3">
                                    <div>
                                      <h4 className="font-bold text-sm mb-1 flex items-center gap-1">
                                        <Brain className="w-4 h-4 text-purple-500" /> สรุป AI
                                      </h4>
                                      <p className="text-sm text-gray-700 bg-white p-2 rounded border">{r.aiSummary}</p>
                                    </div>
                                    {r.strengths && (
                                      <div>
                                        <h4 className="font-bold text-sm mb-1 text-emerald-600">จุดแข็ง</h4>
                                        <p className="text-sm text-gray-700">{r.strengths}</p>
                                      </div>
                                    )}
                                    {r.improvements && (
                                      <div>
                                        <h4 className="font-bold text-sm mb-1 text-amber-600">ข้อเสนอแนะ</h4>
                                        <p className="text-sm text-gray-700">{r.improvements}</p>
                                      </div>
                                    )}
                                    {metrics && (
                                      <div>
                                        <h4 className="font-bold text-sm mb-1 text-blue-600">ข้อมูลประกอบ</h4>
                                        <div className="grid grid-cols-2 gap-1 text-xs">
                                          <div>มาทำงาน: {metrics.presentDays}/{metrics.totalWorkDays} วัน ({metrics.attendanceRate}%)</div>
                                          <div>มาสาย: {metrics.lateDays} วัน</div>
                                          <div>งานได้รับ: {metrics.tasksAssigned} งาน</div>
                                          <div>งานเสร็จ: {metrics.tasksCompleted} งาน ({metrics.taskCompletionRate}%)</div>
                                          <div>OT: {metrics.totalOTHours} ชม.</div>
                                          <div>ลา: {metrics.leaveDays || 0} วัน</div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {results.length > 0 && (() => {
            const salaryIncrease = totalNewSalary - totalCurrentSalary;
            const salaryBudget = parseFloat(String(viewingPeriod.salaryBudget || "0"));
            const bonusBudget = parseFloat(String(viewingPeriod.bonusBudget || "0"));
            const salaryOver = salaryBudget > 0 && salaryIncrease > salaryBudget;
            const bonusOver = bonusBudget > 0 && totalBonus > bonusBudget;
            return (
              <Card className="border-t-4 border-t-blue-500">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-sm flex items-center gap-1"><Wallet className="w-4 h-4 text-blue-500" /> สรุปงบประมาณ</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
                    <div>
                      <div className="text-gray-500">เงินเดือนรวมปัจจุบัน</div>
                      <div className="text-lg font-bold">{fmt(totalCurrentSalary)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">เงินเดือนรวมใหม่</div>
                      <div className="text-lg font-bold text-emerald-600">{fmt(totalNewSalary)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">เพิ่มขึ้น/เดือน</div>
                      <div className="text-lg font-bold text-blue-600">+{fmt(salaryIncrease)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`rounded-lg p-3 border ${salaryOver ? "bg-red-50 border-red-200" : "bg-cyan-50 border-cyan-200"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">งบปรับเงินเดือน</span>
                        {salaryBudget > 0 && (
                          <Badge className={salaryOver ? "bg-red-500 text-white" : "bg-cyan-500 text-white"}>
                            {salaryOver ? "เกินงบ" : "ภายในงบ"}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-xl font-bold ${salaryOver ? "text-red-600" : "text-cyan-700"}`}>
                          {fmt(salaryIncrease)}
                        </span>
                        {salaryBudget > 0 && (
                          <span className="text-sm text-gray-500">/ {fmt(salaryBudget)} บาท</span>
                        )}
                        {salaryBudget <= 0 && (
                          <span className="text-xs text-gray-400">ยังไม่ตั้งงบ</span>
                        )}
                      </div>
                      {salaryBudget > 0 && (
                        <div className="mt-2">
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${salaryOver ? "bg-red-500" : "bg-cyan-500"}`}
                              style={{ width: `${Math.min((salaryIncrease / salaryBudget) * 100, 100)}%` }}
                            />
                          </div>
                          <div className="text-xs mt-1 text-gray-500">
                            คงเหลือ: {fmt(salaryBudget - salaryIncrease)} บาท ({((1 - salaryIncrease / salaryBudget) * 100).toFixed(1)}%)
                          </div>
                        </div>
                      )}
                    </div>
                    <div className={`rounded-lg p-3 border ${bonusOver ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">งบโบนัส</span>
                        {bonusBudget > 0 && (
                          <Badge className={bonusOver ? "bg-red-500 text-white" : "bg-amber-500 text-white"}>
                            {bonusOver ? "เกินงบ" : "ภายในงบ"}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-xl font-bold ${bonusOver ? "text-red-600" : "text-amber-700"}`}>
                          {fmt(totalBonus)}
                        </span>
                        {bonusBudget > 0 && (
                          <span className="text-sm text-gray-500">/ {fmt(bonusBudget)} บาท</span>
                        )}
                        {bonusBudget <= 0 && (
                          <span className="text-xs text-gray-400">ยังไม่ตั้งงบ</span>
                        )}
                      </div>
                      {bonusBudget > 0 && (
                        <div className="mt-2">
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${bonusOver ? "bg-red-500" : "bg-amber-500"}`}
                              style={{ width: `${Math.min((totalBonus / bonusBudget) * 100, 100)}%` }}
                            />
                          </div>
                          <div className="text-xs mt-1 text-gray-500">
                            คงเหลือ: {fmt(bonusBudget - totalBonus)} บาท ({((1 - totalBonus / bonusBudget) * 100).toFixed(1)}%)
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="mt-4 flex gap-3 items-end border-t pt-3">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 block mb-1">งบปรับเงินเดือน (บาท/เดือน)</label>
                        <Input
                          type="number"
                          min="0"
                          step="1000"
                          placeholder="ไม่จำกัด"
                          defaultValue={salaryBudget > 0 ? salaryBudget : ""}
                          onBlur={(e) => {
                            const val = e.target.value;
                            updatePeriodMutation.mutate({ id: viewingPeriodId!, data: { salaryBudget: val || "0" } });
                          }}
                          className="h-9"
                          data-testid="input-salary-budget"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 block mb-1">งบโบนัสรวม (บาท)</label>
                        <Input
                          type="number"
                          min="0"
                          step="1000"
                          placeholder="ไม่จำกัด"
                          defaultValue={bonusBudget > 0 ? bonusBudget : ""}
                          onBlur={(e) => {
                            const val = e.target.value;
                            updatePeriodMutation.mutate({ id: viewingPeriodId!, data: { bonusBudget: val || "0" } });
                          }}
                          className="h-9"
                          data-testid="input-bonus-budget"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}
        </div>

        <AlertDialog open={confirmDialog.open} onOpenChange={(o) => !o && setConfirmDialog({ open: false, type: "", periodId: null })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmDialog.type === "runAi" && "ยืนยันการประเมินด้วย AI"}
                {confirmDialog.type === "approve" && "ยืนยันอนุมัติผลประเมิน"}
                {confirmDialog.type === "applySalary" && "ยืนยันปรับเงินเดือน"}
                {confirmDialog.type === "applyBonus" && "ยืนยันจ่ายโบนัส"}
                {confirmDialog.type === "delete" && "ยืนยันลบรอบประเมิน"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmDialog.type === "runAi" && "AI จะวิเคราะห์ข้อมูลการทำงาน การเข้างาน และงานที่ได้รับมอบหมาย เพื่อประเมินผลงานพนักงานทุกคน"}
                {confirmDialog.type === "approve" && "เมื่ออนุมัติแล้ว จะสามารถดำเนินการปรับเงินเดือนและจ่ายโบนัสแยกกันได้"}
                {confirmDialog.type === "applySalary" && "เงินเดือนฐานของพนักงานจะถูกปรับตามผลประเมิน (เฉพาะเงินเดือน ไม่รวมโบนัส) การดำเนินการนี้ไม่สามารถย้อนกลับได้"}
                {confirmDialog.type === "applyBonus" && "โบนัสจะถูกบันทึกตามผลประเมิน สามารถนำไปจ่ายในรอบเงินเดือนถัดไป การดำเนินการนี้ไม่สามารถย้อนกลับได้"}
                {confirmDialog.type === "delete" && "ข้อมูลรอบประเมินและผลประเมินทั้งหมดจะถูกลบ"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmAction}>ยืนยัน</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4" data-testid="performance-page">
        <Card className="flexy-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-800">AI ประเมินผลงาน</h1>
                  <p className="text-sm text-gray-500">ประเมินผลงานพนักงานอัตโนมัติ พร้อมคำนวณขึ้นเงินเดือนและโบนัส</p>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">ขั้นตอนการประเมิน</p>
            <div className="flex items-center gap-1 text-xs flex-wrap">
              <span className="px-2 py-1 rounded bg-[#fb9678] text-white font-medium">1. สร้างรอบ</span>
              <ChevronRight className="w-3 h-3 text-gray-400" />
              <span className="px-2 py-1 rounded bg-blue-500 text-white font-medium">2. AI ประเมิน</span>
              <ChevronRight className="w-3 h-3 text-gray-400" />
              <span className="px-2 py-1 rounded bg-emerald-500 text-white font-medium">3. อนุมัติ</span>
              <ChevronRight className="w-3 h-3 text-gray-400" />
              <span className="px-2 py-1 rounded bg-cyan-500 text-white font-medium">4. ปรับเงินเดือน</span>
              <ChevronRight className="w-3 h-3 text-gray-400" />
              <span className="px-2 py-1 rounded bg-amber-500 text-white font-medium">5. จ่ายโบนัส</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2 border-b">
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "periods" ? "border-[#fb9678] text-[#fb9678]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            onClick={() => setActiveTab("periods")}
            data-testid="tab-periods"
          >
            รอบประเมิน
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "create" ? "border-[#fb9678] text-[#fb9678]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            onClick={() => setActiveTab("create")}
            data-testid="tab-create"
          >
            <Plus className="w-4 h-4 inline mr-1" /> สร้างรอบประเมินใหม่
          </button>
        </div>

        {activeTab === "create" && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-bold text-lg">สร้างรอบประเมินใหม่</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600 block mb-1">ชื่อรอบประเมิน</label>
                  <Input
                    value={newPeriod.name}
                    onChange={e => setNewPeriod(p => ({ ...p, name: e.target.value }))}
                    placeholder="เช่น ประเมินประจำปี 2568"
                    data-testid="input-period-name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 block mb-1">วันที่เริ่มต้น</label>
                  <ThaiDateInput
                    value={newPeriod.startDate}
                    onChange={(v) => setNewPeriod(p => ({ ...p, startDate: v }))}
                    dateEra={dateEra}
                    dateFmt={dateFmt}
                    data-testid="input-start-date"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 block mb-1">วันที่สิ้นสุด</label>
                  <ThaiDateInput
                    value={newPeriod.endDate}
                    onChange={(v) => setNewPeriod(p => ({ ...p, endDate: v }))}
                    dateEra={dateEra}
                    dateFmt={dateFmt}
                    data-testid="input-end-date"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-sm text-blue-800 mb-2 flex items-center gap-1">
                  <Sparkles className="w-4 h-4" /> หลักเกณฑ์ประเมิน (AI กำหนดให้อัตโนมัติ)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-blue-700">
                  <div>1. ความรับผิดชอบและการมาทำงาน (20%)</div>
                  <div>2. คุณภาพและปริมาณงาน (30%)</div>
                  <div>3. การทำงานตรงเวลา/ส่งงานทันกำหนด (25%)</div>
                  <div>4. ความร่วมมือและการทำงานเป็นทีม (15%)</div>
                  <div>5. การพัฒนาตนเองและความคิดริเริ่ม (10%)</div>
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-medium text-sm text-purple-800 mb-2 flex items-center gap-1">
                  <Award className="w-4 h-4" /> เกณฑ์ขึ้นเงินเดือนและโบนัส (ค่าเริ่มต้น)
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-purple-700">
                  <div className="bg-white rounded p-2 text-center">
                    <Badge className="bg-emerald-500 text-white mb-1">A+</Badge>
                    <div>4.5-5.0 คะแนน</div>
                    <div className="font-bold">ขึ้น 8% | โบนัส 3 เดือน</div>
                  </div>
                  <div className="bg-white rounded p-2 text-center">
                    <Badge className="bg-emerald-400 text-white mb-1">A</Badge>
                    <div>4.0-4.49 คะแนน</div>
                    <div className="font-bold">ขึ้น 6% | โบนัส 2.5 เดือน</div>
                  </div>
                  <div className="bg-white rounded p-2 text-center">
                    <Badge className="bg-blue-500 text-white mb-1">B+</Badge>
                    <div>3.5-3.99 คะแนน</div>
                    <div className="font-bold">ขึ้น 4% | โบนัส 2 เดือน</div>
                  </div>
                  <div className="bg-white rounded p-2 text-center">
                    <Badge className="bg-blue-400 text-white mb-1">B</Badge>
                    <div>3.0-3.49 คะแนน</div>
                    <div className="font-bold">ขึ้น 3% | โบนัส 1.5 เดือน</div>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-medium text-sm text-amber-800 mb-2 flex items-center gap-1">
                  <Wallet className="w-4 h-4" /> งบประมาณ (ไม่บังคับ — ตั้งทีหลังได้)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-amber-700 block mb-1">งบปรับเงินเดือน (บาท/เดือน)</label>
                    <Input
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="ไม่จำกัด"
                      value={newPeriod.salaryBudget}
                      onChange={e => setNewPeriod(p => ({ ...p, salaryBudget: e.target.value }))}
                      data-testid="input-create-salary-budget"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-amber-700 block mb-1">งบโบนัสรวม (บาท)</label>
                    <Input
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="ไม่จำกัด"
                      value={newPeriod.bonusBudget}
                      onChange={e => setNewPeriod(p => ({ ...p, bonusBudget: e.target.value }))}
                      data-testid="input-create-bonus-budget"
                    />
                  </div>
                </div>
              </div>

              <Button onClick={handleCreate} disabled={createMutation.isPending} className="bg-[#fb9678] hover:bg-[#e8856a] text-white" data-testid="button-create-period">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                สร้างรอบประเมิน
              </Button>
            </CardContent>
          </Card>
        )}

        {activeTab === "periods" && (
          <Card>
            <CardContent className="p-0">
              {loadingPeriods ? (
                <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
              ) : periods.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Brain className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-lg font-medium mb-1">ยังไม่มีรอบประเมิน</p>
                  <p className="text-sm mb-4">สร้างรอบประเมินใหม่เพื่อเริ่มประเมินผลงานพนักงาน</p>
                  <Button onClick={() => setActiveTab("create")} className="bg-[#fb9678] hover:bg-[#e8856a] text-white">
                    <Plus className="w-4 h-4 mr-1" /> สร้างรอบประเมินใหม่
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {periods.map((p: any) => {
                    const st = STATUS_MAP[p.status] || STATUS_MAP.draft;
                    const StIcon = st.icon;
                    const nextAction: Record<string, { label: string; color: string; icon: any; action: () => void }> = {
                      draft: { label: "AI ประเมินผลงาน", color: "bg-blue-500 text-white", icon: Sparkles, action: () => setConfirmDialog({ open: true, type: "runAi", periodId: p.id }) },
                      evaluated: { label: "อนุมัติผลประเมิน", color: "bg-emerald-600 text-white hover:bg-emerald-700", icon: ThumbsUp, action: () => { setViewingPeriodId(p.id); } },
                      approved: { label: "ปรับเงินเดือน / จ่ายโบนัส", color: "bg-cyan-600 text-white hover:bg-cyan-700", icon: TrendingUp, action: () => { setViewingPeriodId(p.id); } },
                      salary_applied: { label: "จ่ายโบนัส", color: "bg-amber-600 text-white hover:bg-amber-700", icon: Award, action: () => { setViewingPeriodId(p.id); } },
                      bonus_applied: { label: "ปรับเงินเดือน", color: "bg-cyan-600 text-white hover:bg-cyan-700", icon: TrendingUp, action: () => { setViewingPeriodId(p.id); } },
                    };
                    const next = nextAction[p.status];
                    const NextIcon = next?.icon;
                    return (
                      <div key={p.id} className="p-4 hover:bg-gray-50 transition-colors" data-testid={`row-period-${p.id}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-base">{p.name}</span>
                              <Badge className={st.color}>
                                <StIcon className="w-3 h-3 mr-1" />
                                {st.label}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500">{formatDate(p.startDate, dateEra, dateFmt)} - {formatDate(p.endDate, dateEra, dateFmt)}</p>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            {next && (
                              <Button
                                size="sm"
                                className={next.color}
                                onClick={next.action}
                                disabled={p.status === "draft" && runAiMutation.isPending}
                                data-testid={`button-next-${p.id}`}
                              >
                                {p.status === "draft" && runAiMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                ) : NextIcon ? (
                                  <NextIcon className="w-4 h-4 mr-1" />
                                ) : null}
                                {next.label}
                              </Button>
                            )}
                            {p.status === "applied" && (
                              <Badge className="bg-green-100 text-green-700 border border-green-300">
                                <CheckCircle2 className="w-3 h-3 mr-1" /> เสร็จสิ้น
                              </Badge>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => setViewingPeriodId(p.id)} data-testid={`button-view-${p.id}`}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmDialog({ open: true, type: "delete", periodId: p.id })}
                              data-testid={`button-delete-${p.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </Button>
                          </div>
                        </div>
                        {p.status === "draft" && (
                          <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> ขั้นตอนถัดไป: กดปุ่ม "AI ประเมินผลงาน" เพื่อให้ AI วิเคราะห์ข้อมูลการทำงานของพนักงานทุกคน
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <AlertDialog open={confirmDialog.open} onOpenChange={(o) => !o && setConfirmDialog({ open: false, type: "", periodId: null })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmDialog.type === "runAi" && "ยืนยันการประเมินด้วย AI"}
                {confirmDialog.type === "delete" && "ยืนยันลบรอบประเมิน"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmDialog.type === "runAi" && "AI จะวิเคราะห์ข้อมูลการทำงาน การเข้างาน และงานที่ได้รับมอบหมายจาก Work Board เพื่อประเมินผลงานพนักงานทุกคน อาจใช้เวลา 1-2 นาที"}
                {confirmDialog.type === "delete" && "ข้อมูลรอบประเมินและผลประเมินทั้งหมดจะถูกลบ"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmAction}>ยืนยัน</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
