import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, CheckCircle, Trash2, CheckCheck } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useHrCompanyId } from "@/lib/company-context";

const MONTHS = [
  { value: "1", label: "มกราคม" }, { value: "2", label: "กุมภาพันธ์" },
  { value: "3", label: "มีนาคม" }, { value: "4", label: "เมษายน" },
  { value: "5", label: "พฤษภาคม" }, { value: "6", label: "มิถุนายน" },
  { value: "7", label: "กรกฎาคม" }, { value: "8", label: "สิงหาคม" },
  { value: "9", label: "กันยายน" }, { value: "10", label: "ตุลาคม" },
  { value: "11", label: "พฤศจิกายน" }, { value: "12", label: "ธันวาคม" },
];

function getYearOptions() {
  const current = new Date().getFullYear();
  return [current - 1, current, current + 1].map(y => ({ value: String(y), label: String(y) }));
}

function fmt(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface CommissionRecord {
  id: number;
  employeeName: string;
  totalSales: number;
  commissionRate: number;
  commissionAmount: number;
  status: "draft" | "approved";
}

interface CommissionRule {
  id: number;
  name: string;
  active: boolean;
}

export default function CommissionRecords() {
  const selectedCompanyId = useHrCompanyId();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [selectedRuleId, setSelectedRuleId] = useState<string>("");

  const { data: rules = [] } = useQuery<CommissionRule[]>({
    queryKey: ["/api/commission-rules", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      const r = await fetch(`/api/commission-rules?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: records = [], isLoading } = useQuery<CommissionRecord[]>({
    queryKey: ["/api/commission-records", selectedCompanyId, month, year],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      const r = await fetch(`/api/commission-records?companyId=${selectedCompanyId}&month=${month}&year=${year}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const calculateMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/commission-records/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ companyId: selectedCompanyId, month: parseInt(month), year: parseInt(year), ruleId: parseInt(selectedRuleId) }),
      });
      if (!r.ok) throw new Error("Failed to calculate");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission-records"] });
      toast({ title: "สำเร็จ", description: "คำนวณค่าคอมมิชชั่นเรียบร้อย" });
    },
    onError: () => {
      toast({ title: "ผิดพลาด", description: "ไม่สามารถคำนวณค่าคอมมิชชั่นได้", variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/commission-records/${id}/approve`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to approve");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission-records"] });
      toast({ title: "สำเร็จ", description: "อนุมัติค่าคอมมิชชั่นเรียบร้อย" });
    },
    onError: () => {
      toast({ title: "ผิดพลาด", description: "ไม่สามารถอนุมัติได้", variant: "destructive" });
    },
  });

  const approveAllMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/commission-records/approve-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ companyId: selectedCompanyId, month: parseInt(month), year: parseInt(year) }),
      });
      if (!r.ok) throw new Error("Failed to approve all");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission-records"] });
      toast({ title: "สำเร็จ", description: "อนุมัติค่าคอมมิชชั่นทั้งหมดเรียบร้อย" });
    },
    onError: () => {
      toast({ title: "ผิดพลาด", description: "ไม่สามารถอนุมัติทั้งหมดได้", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/commission-records/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission-records"] });
      toast({ title: "สำเร็จ", description: "ลบรายการค่าคอมมิชชั่นเรียบร้อย" });
    },
    onError: () => {
      toast({ title: "ผิดพลาด", description: "ไม่สามารถลบได้", variant: "destructive" });
    },
  });

  const hasDraftRecords = records.some(r => r.status === "draft");

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Calculator className="h-6 w-6 text-[#fb9678]" />
          <h1 className="text-xl font-bold" data-testid="text-page-title">ค่าคอมมิชชั่น</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base" data-testid="text-filter-title">เลือกเงื่อนไข</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-sm font-medium">เดือน</label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="w-40" data-testid="select-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">ปี</label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="w-28" data-testid="select-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getYearOptions().map(y => (
                      <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">กฎค่าคอมมิชชั่น</label>
                <Select value={selectedRuleId} onValueChange={setSelectedRuleId}>
                  <SelectTrigger className="w-52" data-testid="select-rule">
                    <SelectValue placeholder="เลือกกฎ" />
                  </SelectTrigger>
                  <SelectContent>
                    {rules.filter(r => r.active).map(rule => (
                      <SelectItem key={rule.id} value={String(rule.id)}>{rule.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => calculateMutation.mutate()}
                disabled={!selectedRuleId || calculateMutation.isPending}
                data-testid="button-calculate"
              >
                <Calculator className="h-4 w-4 mr-2" />
                คำนวณค่าคอมมิชชั่น
              </Button>
              {hasDraftRecords && (
                <Button
                  variant="outline"
                  onClick={() => approveAllMutation.mutate()}
                  disabled={approveAllMutation.isPending}
                  data-testid="button-approve-all"
                >
                  <CheckCheck className="h-4 w-4 mr-2" />
                  อนุมัติทั้งหมด
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base" data-testid="text-records-title">
              รายการค่าคอมมิชชั่น - {MONTHS.find(m => m.value === month)?.label} {year}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-loading">กำลังโหลด...</div>
            ) : records.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-empty">ยังไม่มีรายการค่าคอมมิชชั่น</div>
            ) : (
              <Table data-testid="table-records">
                <TableHeader>
                  <TableRow>
                    <TableHead>พนักงาน</TableHead>
                    <TableHead className="text-right">ยอดขายรวม</TableHead>
                    <TableHead className="text-right">อัตราคอมมิชชั่น</TableHead>
                    <TableHead className="text-right">ค่าคอมมิชชั่น</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id} data-testid={`row-record-${record.id}`}>
                      <TableCell className="font-medium" data-testid={`text-employee-name-${record.id}`}>{record.employeeName}</TableCell>
                      <TableCell className="text-right" data-testid={`text-total-sales-${record.id}`}>{fmt(record.totalSales)}</TableCell>
                      <TableCell className="text-right" data-testid={`text-commission-rate-${record.id}`}>{fmt(record.commissionRate)}%</TableCell>
                      <TableCell className="text-right font-semibold" data-testid={`text-commission-amount-${record.id}`}>{fmt(record.commissionAmount)}</TableCell>
                      <TableCell>
                        {record.status === "approved" ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100" data-testid={`badge-approved-${record.id}`}>อนุมัติแล้ว</Badge>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100" data-testid={`badge-draft-${record.id}`}>ฉบับร่าง</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {record.status === "draft" && (
                            <Button variant="ghost" size="icon" onClick={() => approveMutation.mutate(record.id)} data-testid={`button-approve-${record.id}`}>
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(record.id)} data-testid={`button-delete-${record.id}`}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}