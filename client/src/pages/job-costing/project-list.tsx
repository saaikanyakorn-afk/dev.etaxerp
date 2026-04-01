import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useCompany } from "@/lib/company-context";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, HardHat, TrendingUp, TrendingDown, Building2, Eye, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PROJECT_TYPES: Record<string, string> = {
  construction: "ก่อสร้างทั่วไป",
  condo: "คอนโดมิเนียม",
  housing: "บ้านจัดสรร",
  renovation: "ปรับปรุง/ต่อเติม",
  infrastructure: "โครงสร้างพื้นฐาน",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "กำลังดำเนินการ", color: "bg-green-100 text-green-700" },
  completed: { label: "เสร็จสิ้น", color: "bg-blue-100 text-blue-700" },
  cancelled: { label: "ยกเลิก", color: "bg-red-100 text-red-700" },
  on_hold: { label: "ระงับชั่วคราว", color: "bg-yellow-100 text-yellow-700" },
};

export default function JobCostingProjectList() {
  const { selectedCompanyId } = useCompany();
  const companyId = selectedCompanyId;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState<any>(null);
  const [form, setForm] = useState({
    code: "", name: "", description: "", customerName: "",
    projectType: "construction", budgetAmount: "", revenueAmount: "",
    status: "active", startDate: "", endDate: "", notes: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["/api/job-costing/projects", companyId, statusFilter],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/job-costing/projects?companyId=${companyId}&status=${statusFilter}&limit=200`);
      return res.json();
    },
    enabled: !!companyId,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      if (editProject) {
        return apiRequest("PUT", `/api/job-costing/projects/${editProject.id}`, values);
      }
      return apiRequest("POST", "/api/job-costing/projects", { ...values, companyId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-costing/projects"] });
      toast({ title: editProject ? "แก้ไขโปรเจคสำเร็จ" : "สร้างโปรเจคสำเร็จ" });
      setShowForm(false);
      setEditProject(null);
      resetForm();
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/job-costing/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-costing/projects"] });
      toast({ title: "ลบโปรเจคสำเร็จ" });
    },
  });

  function resetForm() {
    setForm({ code: "", name: "", description: "", customerName: "", projectType: "construction", budgetAmount: "", revenueAmount: "", status: "active", startDate: "", endDate: "", notes: "" });
  }

  function openEdit(p: any) {
    setEditProject(p);
    setForm({
      code: p.code || "", name: p.name || "", description: p.description || "",
      customerName: p.customerName || "", projectType: p.projectType || "construction",
      budgetAmount: p.budgetAmount || "", revenueAmount: p.revenueAmount || "",
      status: p.status || "active", startDate: p.startDate || "", endDate: p.endDate || "",
      notes: p.notes || "",
    });
    setShowForm(true);
  }

  function handleSave() {
    if (!form.code.trim() || !form.name.trim()) {
      toast({ title: "กรุณากรอกรหัสและชื่อโปรเจค", variant: "destructive" });
      return;
    }
    saveMutation.mutate(form);
  }

  const projects = (data?.data || []).filter((p: any) =>
    !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.code?.toLowerCase().includes(search.toLowerCase())
  );

  const totalBudget = projects.reduce((s: number, p: any) => s + Number(p.budgetAmount || 0), 0);
  const totalCost = projects.reduce((s: number, p: any) => s + Number(p.total_cost || 0), 0);
  const totalRevenue = projects.reduce((s: number, p: any) => s + Number(p.revenueAmount || 0), 0);

  return (
    <div className="space-y-6" data-testid="job-costing-list">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <HardHat className="h-7 w-7 text-[#fb9678]" /> ต้นทุนงานก่อสร้าง
          </h1>
          <p className="text-gray-500 text-sm mt-1">บริหารต้นทุนและกำไรขาดทุนแต่ละโปรเจค</p>
        </div>
        <Button data-testid="button-new-project" onClick={() => { resetForm(); setEditProject(null); setShowForm(true); }}
          className="bg-[#fb9678] hover:bg-[#e8856a] text-white">
          <Plus className="h-4 w-4 mr-1" /> สร้างโปรเจค
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">โปรเจคทั้งหมด</p>
          <p className="text-2xl font-bold mt-1" data-testid="text-total-projects">{projects.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">งบประมาณรวม</p>
          <p className="text-2xl font-bold mt-1 text-[#539BFF]" data-testid="text-total-budget">{totalBudget.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">ต้นทุนรวม</p>
          <p className="text-2xl font-bold mt-1 text-[#f94d4d]" data-testid="text-total-cost">{totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">รายได้รวม</p>
          <p className="text-2xl font-bold mt-1 text-[#05b187]" data-testid="text-total-revenue">{totalRevenue.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input data-testid="input-search" placeholder="ค้นหาโปรเจค..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกสถานะ</SelectItem>
            <SelectItem value="active">กำลังดำเนินการ</SelectItem>
            <SelectItem value="completed">เสร็จสิ้น</SelectItem>
            <SelectItem value="on_hold">ระงับชั่วคราว</SelectItem>
            <SelectItem value="cancelled">ยกเลิก</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3 font-medium">รหัส</th>
              <th className="text-left p-3 font-medium">ชื่อโปรเจค</th>
              <th className="text-left p-3 font-medium">ประเภท</th>
              <th className="text-left p-3 font-medium">ลูกค้า</th>
              <th className="text-right p-3 font-medium">งบประมาณ</th>
              <th className="text-right p-3 font-medium">ต้นทุนจริง</th>
              <th className="text-center p-3 font-medium">ยูนิต</th>
              <th className="text-center p-3 font-medium">สถานะ</th>
              <th className="text-center p-3 font-medium w-32"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="text-center p-8 text-gray-400">กำลังโหลด...</td></tr>
            ) : projects.length === 0 ? (
              <tr><td colSpan={9} className="text-center p-8 text-gray-400">ยังไม่มีโปรเจค</td></tr>
            ) : projects.map((p: any) => {
              const budget = Number(p.budgetAmount || 0);
              const cost = Number(p.total_cost || 0);
              const pct = budget > 0 ? Math.min((cost / budget) * 100, 100) : 0;
              const st = STATUS_LABELS[p.status] || STATUS_LABELS.active;
              return (
                <tr key={p.id} className="border-b hover:bg-gray-50 cursor-pointer" data-testid={`row-project-${p.id}`}>
                  <td className="p-3 font-mono text-xs">{p.code}</td>
                  <td className="p-3 font-medium" onClick={() => navigate(`/job-costing/projects/${p.id}`)}>{p.name}</td>
                  <td className="p-3 text-gray-600">{PROJECT_TYPES[p.projectType] || p.projectType}</td>
                  <td className="p-3 text-gray-600">{p.customerName || "-"}</td>
                  <td className="p-3 text-right">
                    <div>{budget.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</div>
                    {budget > 0 && (
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                        <div className={`h-1.5 rounded-full ${pct > 90 ? "bg-red-400" : pct > 70 ? "bg-yellow-400" : "bg-green-400"}`} style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-right font-medium">{cost.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                  <td className="p-3 text-center">{p.unit_count || 0}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex gap-1 justify-center">
                      <Button variant="ghost" size="sm" data-testid={`button-view-${p.id}`} onClick={() => navigate(`/job-costing/projects/${p.id}`)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" data-testid={`button-edit-${p.id}`} onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" data-testid={`button-delete-${p.id}`}
                        onClick={() => { if (confirm("ลบโปรเจคนี้?")) deleteMutation.mutate(p.id); }}>
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={showForm} onOpenChange={v => { if (!v) { setShowForm(false); setEditProject(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editProject ? "แก้ไขโปรเจค" : "สร้างโปรเจคใหม่"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <Label>รหัสโปรเจค *</Label>
              <Input data-testid="input-project-code" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="PJ-001" />
            </div>
            <div>
              <Label>ประเภท</Label>
              <Select value={form.projectType} onValueChange={v => setForm(f => ({ ...f, projectType: v }))}>
                <SelectTrigger data-testid="select-project-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PROJECT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>ชื่อโปรเจค *</Label>
              <Input data-testid="input-project-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="คอนโด ABC สุขุมวิท" />
            </div>
            <div className="col-span-2">
              <Label>รายละเอียด</Label>
              <Textarea data-testid="input-description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div>
              <Label>ลูกค้า/เจ้าของโครงการ</Label>
              <Input data-testid="input-customer" value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} />
            </div>
            <div>
              <Label>สถานะ</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>งบประมาณ (บาท)</Label>
              <Input data-testid="input-budget" type="number" value={form.budgetAmount} onChange={e => setForm(f => ({ ...f, budgetAmount: e.target.value }))} />
            </div>
            <div>
              <Label>มูลค่าสัญญา/รายได้รวม (บาท)</Label>
              <Input data-testid="input-revenue" type="number" value={form.revenueAmount} onChange={e => setForm(f => ({ ...f, revenueAmount: e.target.value }))} />
            </div>
            <div>
              <Label>วันที่เริ่ม</Label>
              <Input data-testid="input-start-date" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <Label>วันที่สิ้นสุด</Label>
              <Input data-testid="input-end-date" type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label>หมายเหตุ</Label>
              <Textarea data-testid="input-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => { setShowForm(false); setEditProject(null); }}>ยกเลิก</Button>
            <Button data-testid="button-save-project" onClick={handleSave} disabled={saveMutation.isPending}
              className="bg-[#fb9678] hover:bg-[#e8856a] text-white">
              {saveMutation.isPending ? "กำลังบันทึก..." : editProject ? "บันทึก" : "สร้างโปรเจค"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
