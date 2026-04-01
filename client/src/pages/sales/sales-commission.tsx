import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Percent, Hash, TrendingUp, Calculator, Trash2, Edit, DollarSign, FileText, Receipt, CreditCard } from "lucide-react";

type Tier = { min: number; rate: number };

const COMMISSION_TYPES = [
  { value: "percentage", label: "% ของยอดขาย", icon: Percent, desc: "คิดเปอร์เซ็นต์จากยอดขายรวม" },
  { value: "per_piece", label: "ต่อบิล", icon: Hash, desc: "คิดตามจำนวนเอกสาร" },
  { value: "tiered", label: "ขั้นบันได", icon: TrendingUp, desc: "เปอร์เซ็นต์เพิ่มตามยอดขาย" },
];

const DOC_TYPE_OPTIONS = [
  { value: "tax_invoice", label: "ใบกำกับภาษี", icon: FileText },
  { value: "invoice", label: "ใบแจ้งหนี้", icon: CreditCard },
  { value: "receipt", label: "ใบเสร็จรับเงิน", icon: Receipt },
];

export default function SalesCommission() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [calcMonth, setCalcMonth] = useState(new Date().getMonth() + 1);
  const [calcYear, setCalcYear] = useState(new Date().getFullYear());

  const [name, setName] = useState("");
  const [type, setType] = useState("percentage");
  const [rate, setRate] = useState("0");
  const [perPieceRate, setPerPieceRate] = useState("0");
  const [tiers, setTiers] = useState<Tier[]>([{ min: 0, rate: 2 }, { min: 50000, rate: 3 }, { min: 100000, rate: 5 }]);
  const [minTarget, setMinTarget] = useState("0");
  const [selectedDocTypes, setSelectedDocTypes] = useState<string[]>([]);

  const { data: rules = [] } = useQuery({
    queryKey: ["/api/accounting/commission-rules", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/accounting/commission-rules?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: calcResult, isFetching: calculating } = useQuery({
    queryKey: ["/api/accounting/commission/calculate", selectedCompanyId, calcMonth, calcYear],
    queryFn: async () => {
      const r = await fetch("/api/accounting/commission/calculate", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ companyId: selectedCompanyId, month: calcMonth, year: calcYear }),
      });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editId ? `/api/accounting/commission-rules/${editId}` : "/api/accounting/commission-rules";
      const method = editId ? "PUT" : "POST";
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      if (!r.ok) { const err = await r.json(); throw new Error(err.message); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/commission-rules"] });
      setFormOpen(false); resetForm();
      toast({ title: editId ? "แก้ไขกฎคอมมิชชั่นสำเร็จ" : "สร้างกฎคอมมิชชั่นสำเร็จ" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/accounting/commission-rules/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("ลบไม่สำเร็จ");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/commission-rules"] });
      setDeleteId(null);
      toast({ title: "ลบกฎคอมมิชชั่นสำเร็จ" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const r = await fetch(`/api/accounting/commission-rules/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ active }),
      });
      if (!r.ok) throw new Error("อัพเดทไม่สำเร็จ");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/accounting/commission-rules"] }),
  });

  function resetForm() {
    setName(""); setType("percentage"); setRate("0"); setPerPieceRate("0");
    setTiers([{ min: 0, rate: 2 }, { min: 50000, rate: 3 }, { min: 100000, rate: 5 }]);
    setMinTarget("0"); setEditId(null); setSelectedDocTypes([]);
  }

  function openEdit(rule: any) {
    setEditId(rule.id);
    setName(rule.name);
    setType(rule.type);
    setRate(String(rule.rate));
    setPerPieceRate(String(rule.perPieceRate || 0));
    setTiers(rule.tiers ? JSON.parse(rule.tiers) : [{ min: 0, rate: 2 }]);
    setMinTarget(String(rule.minTarget || 0));
    setSelectedDocTypes(rule.docTypes || []);
    setFormOpen(true);
  }

  function handleSave() {
    if (!name.trim()) { toast({ title: "กรุณาระบุชื่อกฎ", variant: "destructive" }); return; }
    saveMutation.mutate({
      companyId: selectedCompanyId, name, type, rate, perPieceRate,
      tiers: type === "tiered" ? tiers : null,
      basedOn: "revenue", appliesTo: "salesperson", assignScope: "all", minTarget,
      docTypes: selectedDocTypes.length > 0 ? selectedDocTypes : null,
    });
  }

  const typeLabel = (t: string) => COMMISSION_TYPES.find(ct => ct.value === t)?.label || t;
  const docTypeLabel = (k: string) => DOC_TYPE_OPTIONS.find(d => d.value === k)?.label || k;

  const totalCommission = (calcResult?.results || []).reduce((s: number, r: any) => s + r.commissionAmount, 0);

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-primary" />
            <div>
              <h1 data-testid="text-page-title" className="text-xl font-heading font-bold">ค่าคอมมิชชั่นเซลส์</h1>
              <p className="text-sm text-muted-foreground">คอมมิชชั่นจากเอกสารขาย (ใบกำกับภาษี / ใบแจ้งหนี้ / ใบเสร็จ) — คิดตามชื่อเซลส์ในเอกสาร</p>
            </div>
          </div>
          <Button data-testid="btn-create-rule" className="gap-2 bg-[#fb9678] hover:bg-[#fb9678]/90"
            onClick={() => { resetForm(); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> สร้างกฎคอมมิชชั่น
          </Button>
        </div>

        <Tabs defaultValue="rules">
          <TabsList>
            <TabsTrigger value="rules" data-testid="tab-rules">กฎคอมมิชชั่น ({rules.length})</TabsTrigger>
            <TabsTrigger value="calculate" data-testid="tab-calculate">คำนวณคอม</TabsTrigger>
          </TabsList>

          <TabsContent value="rules" className="mt-4">
            {rules.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">ยังไม่มีกฎคอมมิชชั่นฝั่งบัญชี</p>
                  <p className="text-sm text-muted-foreground mt-1">สร้างกฎเพื่อคำนวณค่าคอมให้เซลส์ที่ขายออฟไลน์</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {rules.map((rule: any) => (
                  <Card key={rule.id} data-testid={`card-rule-${rule.id}`} className={!rule.active ? "opacity-50" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-medium text-sm">{rule.name}</span>
                            <Badge variant="outline" className="text-xs">{typeLabel(rule.type)}</Badge>
                            {(rule.docTypes || []).map((dt: string) => (
                              <Badge key={dt} className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-50">{docTypeLabel(dt)}</Badge>
                            ))}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {rule.type === "percentage" && <span>อัตรา {Number(rule.rate)}% ของยอดขาย</span>}
                            {rule.type === "per_piece" && <span>{Number(rule.perPieceRate).toLocaleString()} บาท/บิล</span>}
                            {rule.type === "tiered" && (
                              <span>
                                {(rule.tiers ? JSON.parse(rule.tiers) : []).map((t: Tier, i: number) => (
                                  <span key={i}>{i > 0 ? " | " : ""}{t.min.toLocaleString()}+ → {t.rate}%</span>
                                ))}
                              </span>
                            )}
                            {Number(rule.minTarget) > 0 && <span className="ml-2 text-xs">(ยอดขั้นต่ำ {Number(rule.minTarget).toLocaleString()} บาท)</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={rule.active} onCheckedChange={(v) => toggleMutation.mutate({ id: rule.id, active: v })} data-testid={`switch-active-${rule.id}`} />
                          <Button variant="ghost" size="sm" onClick={() => openEdit(rule)} data-testid={`btn-edit-${rule.id}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteId(rule.id)} data-testid={`btn-delete-${rule.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="calculate" className="mt-4 space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-end gap-4">
                  <div>
                    <Label className="text-sm">เดือน</Label>
                    <Select value={String(calcMonth)} onValueChange={(v) => setCalcMonth(Number(v))}>
                      <SelectTrigger className="w-32" data-testid="select-month"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                          <SelectItem key={m} value={String(m)}>
                            {["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."][m-1]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm">ปี</Label>
                    <Select value={String(calcYear)} onValueChange={(v) => setCalcYear(Number(v))}>
                      <SelectTrigger className="w-28" data-testid="select-year"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[calcYear - 1, calcYear, calcYear + 1].map(y => (
                          <SelectItem key={y} value={String(y)}>{y + 543}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" className="gap-2" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/accounting/commission/calculate"] })}
                    disabled={calculating} data-testid="btn-calculate">
                    <Calculator className="h-4 w-4" /> {calculating ? "กำลังคำนวณ..." : "คำนวณ"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {calcResult && (
              <>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-sm text-muted-foreground">รวมค่าคอมมิชชั่นทั้งหมด</div>
                    <div className="text-3xl font-bold text-primary" data-testid="text-total-commission">
                      {totalCommission.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{(calcResult.results || []).length} รายการ</div>
                  </CardContent>
                </Card>

                {(calcResult.results || []).length > 0 ? (
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>เซลส์</TableHead>
                            <TableHead>กฎ</TableHead>
                            <TableHead className="text-right">ยอดขาย</TableHead>
                            <TableHead className="text-right">จำนวนบิล</TableHead>
                            <TableHead className="text-right">อัตรา</TableHead>
                            <TableHead className="text-right">ค่าคอม</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(calcResult.results || []).map((r: any, idx: number) => (
                            <TableRow key={idx} data-testid={`row-commission-${idx}`}>
                              <TableCell className="text-sm font-medium">{r.salesperson}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">{r.ruleName}</Badge>
                              </TableCell>
                              <TableCell className="text-right text-sm">{Number(r.totalSales).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell className="text-right text-sm">{Number(r.totalDocs).toLocaleString()}</TableCell>
                              <TableCell className="text-right text-sm">
                                {r.ruleType === "per_piece" ? `${Number(r.commissionRate).toLocaleString()} บ/บิล` : `${Number(r.commissionRate)}%`}
                              </TableCell>
                              <TableCell className="text-right text-sm font-bold text-green-600">
                                {Number(r.commissionAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      ไม่มีข้อมูลคอมมิชชั่นในเดือนนี้ — ตรวจสอบว่ามีเอกสารขายที่ระบุชื่อเซลส์ (status: approved)
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) { setFormOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-commission-form">
          <DialogHeader>
            <DialogTitle>{editId ? "แก้ไขกฎคอมมิชชั่น" : "สร้างกฎคอมมิชชั่น (เซลส์บัญชี)"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">ชื่อกฎ *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น คอม 3% ยอดขาย" data-testid="input-rule-name" className="mt-1" />
            </div>

            <div>
              <Label className="text-sm">ประเภทการคิดค่าคอม *</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {COMMISSION_TYPES.map(ct => (
                  <button key={ct.value} data-testid={`btn-type-${ct.value}`}
                    className={`p-3 rounded-lg border text-left transition-colors ${type === ct.value ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"}`}
                    onClick={() => setType(ct.value)}>
                    <ct.icon className={`h-5 w-5 mb-1 ${type === ct.value ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="text-xs font-medium">{ct.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{ct.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {type === "percentage" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">อัตราคอมมิชชั่น (%)</Label>
                  <Input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} data-testid="input-rate" className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm">ยอดขายขั้นต่ำ (บาท)</Label>
                  <Input type="number" value={minTarget} onChange={(e) => setMinTarget(e.target.value)} data-testid="input-min-target" className="mt-1" />
                </div>
              </div>
            )}

            {type === "per_piece" && (
              <div>
                <Label className="text-sm">ค่าคอมต่อบิล (บาท)</Label>
                <Input type="number" step="0.01" value={perPieceRate} onChange={(e) => setPerPieceRate(e.target.value)} data-testid="input-per-piece" className="mt-1" />
              </div>
            )}

            {type === "tiered" && (
              <div>
                <Label className="text-sm">ขั้นบันไดค่าคอม</Label>
                <div className="space-y-2 mt-1">
                  {tiers.map((tier, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-20">ยอดขาย ≥</span>
                      <Input type="number" value={tier.min} className="w-28 h-8 text-sm"
                        onChange={(e) => { const t = [...tiers]; t[idx] = { ...t[idx], min: Number(e.target.value) }; setTiers(t); }}
                        data-testid={`input-tier-min-${idx}`} />
                      <span className="text-xs text-muted-foreground">→</span>
                      <Input type="number" step="0.01" value={tier.rate} className="w-20 h-8 text-sm"
                        onChange={(e) => { const t = [...tiers]; t[idx] = { ...t[idx], rate: Number(e.target.value) }; setTiers(t); }}
                        data-testid={`input-tier-rate-${idx}`} />
                      <span className="text-xs text-muted-foreground">%</span>
                      {tiers.length > 1 && (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500"
                          onClick={() => setTiers(tiers.filter((_, i) => i !== idx))}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setTiers([...tiers, { min: 0, rate: 0 }])} data-testid="btn-add-tier">
                    <Plus className="h-3 w-3 mr-1" /> เพิ่มขั้น
                  </Button>
                </div>
              </div>
            )}

            <div>
              <Label className="text-sm">ประเภทเอกสารที่ใช้คิดคอม</Label>
              <p className="text-xs text-muted-foreground mb-2">เลือกเอกสารที่จะนำมาคำนวณ (ไม่เลือก = ทุกประเภท)</p>
              <div className="space-y-2">
                {DOC_TYPE_OPTIONS.map(dt => (
                  <label key={dt.value} className="flex items-center gap-2 cursor-pointer" data-testid={`check-doc-${dt.value}`}>
                    <Checkbox checked={selectedDocTypes.includes(dt.value)}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedDocTypes([...selectedDocTypes, dt.value]);
                        else setSelectedDocTypes(selectedDocTypes.filter(d => d !== dt.value));
                      }} />
                    <dt.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{dt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFormOpen(false); resetForm(); }}>ยกเลิก</Button>
            <Button className="bg-[#fb9678] hover:bg-[#fb9678]/90 gap-2" onClick={handleSave}
              disabled={saveMutation.isPending} data-testid="btn-save-rule">
              {saveMutation.isPending ? "กำลังบันทึก..." : editId ? "บันทึก" : "สร้างกฎ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันลบกฎคอมมิชชั่น</AlertDialogTitle>
            <AlertDialogDescription>ต้องการลบกฎคอมมิชชั่นนี้หรือไม่?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
              disabled={deleteMutation.isPending} data-testid="btn-confirm-delete">
              {deleteMutation.isPending ? "กำลังลบ..." : "ยืนยันลบ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
