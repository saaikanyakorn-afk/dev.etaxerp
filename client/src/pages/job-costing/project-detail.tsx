import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useCompany } from "@/lib/company-context";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Trash2, Building2, TrendingUp, Wallet, BarChart3, Home, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const COST_CATEGORIES: Record<string, { label: string; color: string }> = {
  material: { label: "วัสดุ", color: "bg-blue-100 text-blue-700" },
  labor: { label: "ค่าแรง", color: "bg-green-100 text-green-700" },
  subcontract: { label: "เหมาช่วง", color: "bg-purple-100 text-purple-700" },
  equipment: { label: "เครื่องจักร", color: "bg-orange-100 text-orange-700" },
  overhead: { label: "ค่าใช้จ่ายส่วนกลาง", color: "bg-yellow-100 text-yellow-700" },
  other: { label: "อื่นๆ", color: "bg-gray-100 text-gray-700" },
};

const UNIT_TYPES: Record<string, string> = { room: "ห้อง", house: "หลัง", lot: "แปลง", unit: "ยูนิต" };
const UNIT_STATUS: Record<string, { label: string; color: string }> = {
  available: { label: "ว่าง", color: "bg-green-100 text-green-700" },
  reserved: { label: "จอง", color: "bg-yellow-100 text-yellow-700" },
  sold: { label: "ขายแล้ว", color: "bg-blue-100 text-blue-700" },
  transferred: { label: "โอนแล้ว", color: "bg-gray-100 text-gray-700" },
};

export default function ProjectDetail() {
  const [, params] = useRoute("/job-costing/projects/:id");
  const projectId = Number(params?.id);
  const [, navigate] = useLocation();
  const { selectedCompanyId } = useCompany();
  const companyId = selectedCompanyId;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("overview");
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [showCostForm, setShowCostForm] = useState(false);
  const [unitForm, setUnitForm] = useState({ unitCode: "", unitType: "room", areaSize: "", sellingPrice: "", buyerName: "", status: "available", notes: "" });
  const [costForm, setCostForm] = useState({ description: "", amount: "", costCategory: "material", unitId: "", allocatedDate: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["/api/job-costing/projects", projectId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/job-costing/projects/${projectId}`);
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: plData } = useQuery({
    queryKey: ["/api/job-costing/projects", projectId, "profit-loss"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/job-costing/projects/${projectId}/profit-loss`);
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: unitCostData } = useQuery({
    queryKey: ["/api/job-costing/projects", projectId, "unit-costs"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/job-costing/projects/${projectId}/unit-costs`);
      return res.json();
    },
    enabled: !!projectId,
  });

  const addUnitMutation = useMutation({
    mutationFn: async (values: any) => apiRequest("POST", "/api/job-costing/units", { ...values, projectId, companyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-costing/projects", projectId] });
      toast({ title: "เพิ่มยูนิตสำเร็จ" });
      setShowUnitForm(false);
      setUnitForm({ unitCode: "", unitType: "room", areaSize: "", sellingPrice: "", buyerName: "", status: "available", notes: "" });
    },
  });

  const deleteUnitMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/job-costing/units/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-costing/projects", projectId] });
      toast({ title: "ลบยูนิตสำเร็จ" });
    },
  });

  const addCostMutation = useMutation({
    mutationFn: async (values: any) => apiRequest("POST", "/api/job-costing/costs", { ...values, projectId, companyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-costing/projects", projectId] });
      toast({ title: "เพิ่มต้นทุนสำเร็จ" });
      setShowCostForm(false);
      setCostForm({ description: "", amount: "", costCategory: "material", unitId: "", allocatedDate: "" });
    },
  });

  const deleteCostMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/job-costing/costs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-costing/projects", projectId] });
      toast({ title: "ลบต้นทุนสำเร็จ" });
    },
  });

  if (isLoading) return <div className="p-6 text-center text-gray-400">กำลังโหลด...</div>;
  if (!data?.project) return <div className="p-6 text-center text-gray-400">ไม่พบโปรเจค</div>;

  const { project, units, costs, summary } = data;
  const totalCost = Number(summary?.total_cost || 0);
  const revenue = Number(project.revenueAmount || 0);
  const budget = Number(project.budgetAmount || 0);
  const profit = revenue - totalCost;
  const budgetPct = budget > 0 ? (totalCost / budget * 100) : 0;

  return (
    <div className="space-y-6" data-testid="job-costing-detail">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/job-costing")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" /> กลับ
        </Button>
        <div>
          <h1 className="text-xl font-bold" data-testid="text-project-name">{project.name}</h1>
          <p className="text-xs text-gray-500">{project.code} • {project.customerName || "ไม่ระบุลูกค้า"}</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">ภาพรวม</TabsTrigger>
          <TabsTrigger value="units" data-testid="tab-units">ยูนิต ({units?.length || 0})</TabsTrigger>
          <TabsTrigger value="costs" data-testid="tab-costs">ต้นทุน ({costs?.length || 0})</TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports">รายงาน</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SummaryCard icon={Wallet} label="งบประมาณ" value={budget} color="#539BFF" sub={budget > 0 ? `ใช้ไป ${budgetPct.toFixed(1)}%` : undefined} />
            <SummaryCard icon={Package} label="ต้นทุนจริง" value={totalCost} color="#f94d4d" />
            <SummaryCard icon={TrendingUp} label="รายได้/มูลค่าสัญญา" value={revenue} color="#05b187" />
            <SummaryCard icon={BarChart3} label="กำไร(ขาดทุน)" value={profit} color={profit >= 0 ? "#05b187" : "#f94d4d"} sub={revenue > 0 ? `Margin ${(profit / revenue * 100).toFixed(1)}%` : undefined} />
          </div>

          {budget > 0 && (
            <div className="bg-white rounded-xl border p-4">
              <p className="text-sm font-medium mb-2">สัดส่วนงบประมาณที่ใช้</p>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div className={`h-4 rounded-full transition-all ${budgetPct > 90 ? "bg-red-400" : budgetPct > 70 ? "bg-yellow-400" : "bg-green-400"}`}
                  style={{ width: `${Math.min(budgetPct, 100)}%` }} />
              </div>
              <p className="text-xs text-gray-500 mt-1">{totalCost.toLocaleString("th-TH")} / {budget.toLocaleString("th-TH")} บาท ({budgetPct.toFixed(1)}%)</p>
            </div>
          )}

          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm font-medium mb-3">สัดส่วนต้นทุนแยกตามประเภท</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(COST_CATEGORIES).map(([key, cat]) => {
                const val = Number(summary?.[`${key}_cost`] || 0);
                const pct = totalCost > 0 ? (val / totalCost * 100) : 0;
                return (
                  <div key={key} className="flex items-center justify-between p-2 rounded bg-gray-50">
                    <span className={`text-xs px-2 py-0.5 rounded ${cat.color}`}>{cat.label}</span>
                    <div className="text-right">
                      <p className="text-sm font-medium">{val.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
                      <p className="text-xs text-gray-400">{pct.toFixed(1)}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {project.description && (
            <div className="bg-white rounded-xl border p-4">
              <p className="text-sm font-medium mb-1">รายละเอียด</p>
              <p className="text-sm text-gray-600">{project.description}</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="units" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{units?.length || 0} ยูนิต</p>
            <Button size="sm" onClick={() => setShowUnitForm(true)} className="bg-[#fb9678] hover:bg-[#e8856a] text-white" data-testid="button-add-unit">
              <Plus className="h-4 w-4 mr-1" /> เพิ่มยูนิต
            </Button>
          </div>
          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3 font-medium">รหัส</th>
                  <th className="text-left p-3 font-medium">ประเภท</th>
                  <th className="text-right p-3 font-medium">พื้นที่ (ตร.ม.)</th>
                  <th className="text-right p-3 font-medium">ราคาขาย</th>
                  <th className="text-left p-3 font-medium">ผู้ซื้อ</th>
                  <th className="text-center p-3 font-medium">สถานะ</th>
                  <th className="text-center p-3 font-medium w-16"></th>
                </tr>
              </thead>
              <tbody>
                {(units || []).map((u: any) => {
                  const st = UNIT_STATUS[u.status] || UNIT_STATUS.available;
                  return (
                    <tr key={u.id} className="border-b hover:bg-gray-50" data-testid={`row-unit-${u.id}`}>
                      <td className="p-3 font-mono">{u.unitCode}</td>
                      <td className="p-3">{UNIT_TYPES[u.unitType] || u.unitType}</td>
                      <td className="p-3 text-right">{u.areaSize || "-"}</td>
                      <td className="p-3 text-right">{Number(u.sellingPrice || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                      <td className="p-3">{u.buyerName || "-"}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${st.color}`}>{st.label}</span>
                      </td>
                      <td className="p-3 text-center">
                        <Button variant="ghost" size="sm" onClick={() => { if (confirm("ลบยูนิตนี้?")) deleteUnitMutation.mutate(u.id); }}>
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {(!units || units.length === 0) && (
                  <tr><td colSpan={7} className="text-center p-8 text-gray-400">ยังไม่มียูนิต</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="costs" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{costs?.length || 0} รายการ — รวม {totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท</p>
            <Button size="sm" onClick={() => setShowCostForm(true)} className="bg-[#fb9678] hover:bg-[#e8856a] text-white" data-testid="button-add-cost">
              <Plus className="h-4 w-4 mr-1" /> เพิ่มต้นทุน
            </Button>
          </div>
          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3 font-medium">วันที่</th>
                  <th className="text-left p-3 font-medium">รายการ</th>
                  <th className="text-left p-3 font-medium">ประเภท</th>
                  <th className="text-left p-3 font-medium">ยูนิต</th>
                  <th className="text-right p-3 font-medium">จำนวนเงิน</th>
                  <th className="text-center p-3 font-medium w-16"></th>
                </tr>
              </thead>
              <tbody>
                {(costs || []).map((c: any) => {
                  const cat = COST_CATEGORIES[c.cost_category || c.costCategory] || COST_CATEGORIES.other;
                  return (
                    <tr key={c.id} className="border-b hover:bg-gray-50" data-testid={`row-cost-${c.id}`}>
                      <td className="p-3 text-xs">{c.allocated_date || c.allocatedDate || "-"}</td>
                      <td className="p-3">{c.description}</td>
                      <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs ${cat.color}`}>{cat.label}</span></td>
                      <td className="p-3">{c.unit_code || c.unitCode || "ส่วนกลาง"}</td>
                      <td className="p-3 text-right font-medium">{Number(c.amount).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-center">
                        <Button variant="ghost" size="sm" onClick={() => { if (confirm("ลบ?")) deleteCostMutation.mutate(c.id); }}>
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {(!costs || costs.length === 0) && (
                  <tr><td colSpan={6} className="text-center p-8 text-gray-400">ยังไม่มีรายการต้นทุน</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4 mt-4">
          {plData && (
            <div className="bg-white rounded-xl border p-4 space-y-4">
              <h3 className="font-medium">กำไรขาดทุนโปรเจค</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-gray-500">รายได้</p>
                  <p className="text-xl font-bold text-green-700" data-testid="text-pl-revenue">{plData.revenue?.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-xs text-gray-500">ต้นทุนรวม</p>
                  <p className="text-xl font-bold text-red-700" data-testid="text-pl-cost">{plData.totalCost?.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
              <div className={`p-4 rounded-lg ${plData.profit >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                <p className="text-xs text-gray-500">กำไร(ขาดทุน)สุทธิ</p>
                <p className={`text-2xl font-bold ${plData.profit >= 0 ? "text-green-700" : "text-red-700"}`} data-testid="text-pl-profit">
                  {plData.profit?.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs mt-1">Margin: {plData.margin}% | ใช้งบ: {plData.budgetUsed}%</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">ต้นทุนแยกตามประเภท</p>
                {(plData.costBreakdown || []).map((row: any) => {
                  const cat = COST_CATEGORIES[row.cost_category] || COST_CATEGORIES.other;
                  return (
                    <div key={row.cost_category} className="flex justify-between py-1.5 border-b last:border-0">
                      <span className={`text-xs px-2 py-0.5 rounded ${cat.color}`}>{cat.label}</span>
                      <span className="font-medium">{Number(row.total).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {unitCostData && unitCostData.units?.length > 0 && (
            <div className="bg-white rounded-xl border p-4">
              <h3 className="font-medium mb-3">ต้นทุนต่อยูนิต</h3>
              <p className="text-xs text-gray-400 mb-3">ต้นทุนส่วนกลาง {unitCostData.sharedCostTotal?.toLocaleString("th-TH")} บาท จัดสรรตามสัดส่วนพื้นที่</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-2 font-medium">ยูนิต</th>
                      <th className="text-right p-2 font-medium">พื้นที่</th>
                      <th className="text-right p-2 font-medium">ต้นทุนตรง</th>
                      <th className="text-right p-2 font-medium">ส่วนกลาง</th>
                      <th className="text-right p-2 font-medium">ต้นทุนรวม</th>
                      <th className="text-right p-2 font-medium">ราคาขาย</th>
                      <th className="text-right p-2 font-medium">กำไร</th>
                      <th className="text-right p-2 font-medium">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unitCostData.units.map((u: any) => (
                      <tr key={u.id} className="border-b hover:bg-gray-50" data-testid={`row-unit-cost-${u.id}`}>
                        <td className="p-2 font-mono">{u.unitCode}</td>
                        <td className="p-2 text-right">{u.areaSize || "-"}</td>
                        <td className="p-2 text-right">{u.directCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                        <td className="p-2 text-right">{u.allocatedSharedCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                        <td className="p-2 text-right font-medium">{u.totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                        <td className="p-2 text-right">{u.sellingPrice.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                        <td className={`p-2 text-right font-medium ${u.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {u.profit.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                        </td>
                        <td className={`p-2 text-right ${u.margin >= 0 ? "text-green-600" : "text-red-600"}`}>{u.margin}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showUnitForm} onOpenChange={setShowUnitForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>เพิ่มยูนิต</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>รหัสยูนิต *</Label>
                <Input data-testid="input-unit-code" value={unitForm.unitCode} onChange={e => setUnitForm(f => ({ ...f, unitCode: e.target.value }))} placeholder="A101" />
              </div>
              <div>
                <Label>ประเภท</Label>
                <Select value={unitForm.unitType} onValueChange={v => setUnitForm(f => ({ ...f, unitType: v }))}>
                  <SelectTrigger data-testid="select-unit-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(UNIT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>พื้นที่ (ตร.ม.)</Label>
                <Input data-testid="input-area" type="number" value={unitForm.areaSize} onChange={e => setUnitForm(f => ({ ...f, areaSize: e.target.value }))} />
              </div>
              <div>
                <Label>ราคาขาย (บาท)</Label>
                <Input data-testid="input-selling-price" type="number" value={unitForm.sellingPrice} onChange={e => setUnitForm(f => ({ ...f, sellingPrice: e.target.value }))} />
              </div>
              <div>
                <Label>ผู้ซื้อ</Label>
                <Input data-testid="input-buyer" value={unitForm.buyerName} onChange={e => setUnitForm(f => ({ ...f, buyerName: e.target.value }))} />
              </div>
              <div>
                <Label>สถานะ</Label>
                <Select value={unitForm.status} onValueChange={v => setUnitForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger data-testid="select-unit-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(UNIT_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowUnitForm(false)}>ยกเลิก</Button>
              <Button data-testid="button-save-unit" onClick={() => addUnitMutation.mutate(unitForm)}
                className="bg-[#fb9678] hover:bg-[#e8856a] text-white" disabled={addUnitMutation.isPending}>
                {addUnitMutation.isPending ? "กำลังบันทึก..." : "เพิ่มยูนิต"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCostForm} onOpenChange={setShowCostForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>เพิ่มรายการต้นทุน</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-3">
            <div>
              <Label>รายละเอียด *</Label>
              <Input data-testid="input-cost-desc" value={costForm.description} onChange={e => setCostForm(f => ({ ...f, description: e.target.value }))} placeholder="ค่าวัสดุก่อสร้าง" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>จำนวนเงิน (บาท) *</Label>
                <Input data-testid="input-cost-amount" type="number" value={costForm.amount} onChange={e => setCostForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <Label>ประเภทต้นทุน</Label>
                <Select value={costForm.costCategory} onValueChange={v => setCostForm(f => ({ ...f, costCategory: v }))}>
                  <SelectTrigger data-testid="select-cost-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(COST_CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ยูนิต (ถ้ามี)</Label>
                <Select value={costForm.unitId || "none"} onValueChange={v => setCostForm(f => ({ ...f, unitId: v === "none" ? "" : v }))}>
                  <SelectTrigger data-testid="select-cost-unit"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ส่วนกลาง (ไม่ระบุยูนิต)</SelectItem>
                    {(units || []).map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.unitCode}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>วันที่</Label>
                <Input data-testid="input-cost-date" type="date" value={costForm.allocatedDate} onChange={e => setCostForm(f => ({ ...f, allocatedDate: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowCostForm(false)}>ยกเลิก</Button>
              <Button data-testid="button-save-cost" onClick={() => {
                const payload: any = { ...costForm, amount: costForm.amount };
                if (costForm.unitId) payload.unitId = Number(costForm.unitId);
                else delete payload.unitId;
                addCostMutation.mutate(payload);
              }}
                className="bg-[#fb9678] hover:bg-[#e8856a] text-white" disabled={addCostMutation.isPending}>
                {addCostMutation.isPending ? "กำลังบันทึก..." : "เพิ่มต้นทุน"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color, sub }: { icon: any; label: string; value: number; color: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4" style={{ color }} />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-xl font-bold" style={{ color }}>{value.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
